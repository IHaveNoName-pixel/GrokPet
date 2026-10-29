using System.Runtime.InteropServices;
using Windows.Devices.Radios;
internal static class QuickControls {
 [StructLayout(LayoutKind.Sequential)] private struct Power{public byte AC,Battery,Percent,Reserved;public uint Life,Full;}
 [DllImport("kernel32.dll")] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool GetSystemPowerStatus(out Power p);
 private static object Battery(){if(!GetSystemPowerStatus(out var p))return new{supported=false};return (object)new{supported=true,present=(p.Battery&128)==0,percent=p.Percent<=100?(int?)p.Percent:null,charging=p.AC==1};}
 private static object Brightness(int? value=null){object? locator=null,service=null,rows=null;var owned=new List<object>();string stage="连接";try{
 locator=Activator.CreateInstance(Type.GetTypeFromProgID("WbemScripting.SWbemLocator")!);service=((dynamic)locator!).ConnectServer(".",@"root\WMI");((dynamic)service).Security_.ImpersonationLevel=3;rows=((dynamic)service).ExecQuery("SELECT * FROM WmiMonitorBrightness WHERE Active=TRUE");string? instance=null;int current=0;foreach(dynamic row in (System.Collections.IEnumerable)rows){owned.Add(row);instance=(string)row.InstanceName;current=(int)row.CurrentBrightness;break;}if(instance==null)return new{supported=false,reason="显示器未提供亮度接口"};
 if(value.HasValue){if(value<0||value>100)throw new ArgumentException("Brightness range");
 var psi=new System.Diagnostics.ProcessStartInfo(System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe")){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
 foreach(var arg in new[]{"-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop';Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=[uint32]0;Brightness=[byte]"+value.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)+"} | Out-Null; Start-Sleep -Milliseconds 200; $v=Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness | Where-Object Active | Select-Object -First 1; [int]$v.CurrentBrightness"})psi.ArgumentList.Add(arg);
 using var process=System.Diagnostics.Process.Start(psi)??throw new InvalidOperationException("亮度控制无法启动");if(!process.WaitForExit(6000)){process.Kill(true);throw new TimeoutException("亮度控制超时");}if(process.ExitCode!=0)throw new InvalidOperationException("设备拒绝亮度控制，请打开显示设置");var actual=process.StandardOutput.ReadToEnd().Trim();if(!int.TryParse(actual,out int applied)||applied<0||applied>100)throw new InvalidOperationException("无法读取设置后的亮度");return new{supported=true,value=applied};}

 return (object)new{supported=true,value=current};
 }catch(Exception e){return new{supported=false,reason="亮度接口不可用（"+stage+"）："+e.Message};}finally{foreach(var item in owned.AsEnumerable().Reverse().Concat(new[]{rows,service,locator}))if(item!=null&&Marshal.IsComObject(item))Marshal.ReleaseComObject(item);}}
 internal static async Task Run(string action,string value){
 if(action=="brightness"){if(!int.TryParse(value,out int level)||level<0||level>100)throw new ArgumentException("Invalid brightness");Program.Emit(new{ok=true,brightness=Brightness(level)});return;}
 IReadOnlyList<Radio> radios=Array.Empty<Radio>();try{radios=await Radio.GetRadiosAsync();}catch{}
 if(action is "wifi" or "bluetooth"){
 var kind=action=="wifi"?RadioKind.WiFi:RadioKind.Bluetooth;var matches=radios.Where(r=>r.Kind==kind).ToArray();if(matches.Length!=1){Program.Emit(new{ok=false,reason=matches.Length==0?"未找到无线设备":"存在多个无线设备，请在 Windows 设置中选择"});return;}
 if(value!="on"&&value!="off")throw new ArgumentException("Invalid radio state");var access=await Radio.RequestAccessAsync();if(access!=RadioAccessStatus.Allowed){Program.Emit(new{ok=false,reason="Windows 未授予无线控制权限"});return;}
 var status=await matches[0].SetStateAsync(value=="on"?RadioState.On:RadioState.Off);await Task.Delay(300);Program.Emit(new{ok=status==RadioAccessStatus.Allowed,state=matches[0].State.ToString().ToLowerInvariant(),reason=status==RadioAccessStatus.Allowed?"":"设备或系统拒绝切换"});return;
 }
 if(action!="status")throw new ArgumentException("Unknown quick operation");object Info(RadioKind kind){var list=radios.Where(r=>r.Kind==kind).ToArray();return new{supported=list.Length>0,controllable=list.Length==1,state=list.Length==1?list[0].State.ToString().ToLowerInvariant():"unknown",count=list.Length};}
 Program.Emit(new{ok=true,wifi=Info(RadioKind.WiFi),bluetooth=Info(RadioKind.Bluetooth),brightness=Brightness(),battery=Battery()});
 }
}
