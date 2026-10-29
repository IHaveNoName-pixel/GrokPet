using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Devices.WiFi;
using Windows.Networking.Connectivity;
internal static class QuickChoices{
 private static string Token(string id)=>Convert.ToBase64String(Encoding.UTF8.GetBytes(id));
 internal static async Task Run(string action,string value){
 if(action=="wifi-list"||action=="wifi-connect"){WifiChoices.Run(action,value);return;}
 if(action=="bluetooth-list"){
 var result=new List<object>();foreach(var selector in new[]{BluetoothDevice.GetDeviceSelectorFromPairingState(true),BluetoothLEDevice.GetDeviceSelectorFromPairingState(true)})try{var devices=await DeviceInformation.FindAllAsync(selector,new[]{"System.Devices.Aep.IsConnected"});foreach(var d in devices){bool? connected=d.Properties.TryGetValue("System.Devices.Aep.IsConnected",out object? v)&&v is bool b?b:null;result.Add(new{id=Token(d.Id),name=d.Name,paired=d.Pairing.IsPaired,connected});}}catch{}
 Program.Emit(new{ok=true,items=result});return;
 }
 if(action.StartsWith("power-")){PowerChoices.Run(action,value);return;}throw new ArgumentException("Invalid choice action");
 }
}
internal static class PowerChoices{
 [DllImport("powrprof.dll")]private static extern uint PowerGetActiveScheme(IntPtr root,out IntPtr scheme);
 [DllImport("kernel32.dll")]private static extern IntPtr LocalFree(IntPtr pointer);
 [DllImport("powrprof.dll")]private static extern uint PowerEnumerate(IntPtr root,IntPtr scheme,IntPtr subgroup,uint access,uint index,IntPtr buffer,ref uint size);
 [DllImport("powrprof.dll")]private static extern uint PowerReadFriendlyName(IntPtr root,ref Guid scheme,IntPtr subgroup,IntPtr setting,byte[]? buffer,ref uint size);
 [DllImport("powrprof.dll")]private static extern uint PowerSetActiveScheme(IntPtr root,ref Guid scheme);
 [DllImport("powrprof.dll")]private static extern uint PowerReadACValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,out uint value);
 [DllImport("powrprof.dll")]private static extern uint PowerReadDCValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,out uint value);
 [DllImport("powrprof.dll")]private static extern uint PowerWriteACValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,uint value);
 [DllImport("powrprof.dll")]private static extern uint PowerWriteDCValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,uint value);
 private static Guid Active(){if(PowerGetActiveScheme(IntPtr.Zero,out var p)!=0)throw new InvalidOperationException("无法读取电源计划");try{return Marshal.PtrToStructure<Guid>(p);}finally{LocalFree(p);}}
 private static List<(Guid id,string name)> Plans(){var result=new List<(Guid,string)>();var p=Marshal.AllocHGlobal(16);try{for(uint i=0;i<64;i++){uint size=16;var status=PowerEnumerate(IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,16,i,p,ref size);if(status!=0)break;var id=Marshal.PtrToStructure<Guid>(p);uint length=0;PowerReadFriendlyName(IntPtr.Zero,ref id,IntPtr.Zero,IntPtr.Zero,null,ref length);var buffer=new byte[Math.Min(length,4096)];if(buffer.Length>0)PowerReadFriendlyName(IntPtr.Zero,ref id,IntPtr.Zero,IntPtr.Zero,buffer,ref length);result.Add((id,buffer.Length>0?Encoding.Unicode.GetString(buffer).TrimEnd('\0'):id.ToString()));}}finally{Marshal.FreeHGlobal(p);}return result;}
 private static (Guid sub,Guid setting) Keys(string kind)=>kind=="display"?(new("7516b95f-f776-4464-8c53-06167f40cc99"),new("3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e")):kind=="sleep"?(new("238c9fa8-0aad-41ed-83f4-97be242c8f20"),new("29f6c1db-86da-48c5-9fdb-f2b67b1f44da")):throw new ArgumentException("Invalid power setting");
 private static uint? Read(Guid id,string kind,bool ac){var k=Keys(kind);var result=ac?PowerReadACValueIndex(IntPtr.Zero,ref id,ref k.sub,ref k.setting,out var a):PowerReadDCValueIndex(IntPtr.Zero,ref id,ref k.sub,ref k.setting,out a);return result==0?a/60:null;}
 internal static void Run(string action,string value){try{var current=Active();var plans=Plans();
 if(action=="power-plan"){if(!Guid.TryParse(value,out var id)||!plans.Any(p=>p.id==id))throw new InvalidOperationException("电源计划不存在");if(PowerSetActiveScheme(IntPtr.Zero,ref id)!=0||Active()!=id)throw new InvalidOperationException("系统策略拒绝切换电源计划");current=id;}
 if(action=="power-timeout"){using var d=JsonDocument.Parse(value);var root=d.RootElement;var kind=root.GetProperty("kind").GetString()??"";var source=root.GetProperty("source").GetString();var minutes=root.GetProperty("minutes").GetInt32();if(source!="ac"&&source!="battery"||!new[]{0,1,2,3,5,10,15,20,30,60,120,180}.Contains(minutes))throw new ArgumentException("Invalid timeout");var k=Keys(kind);var ac=source=="ac";var status=ac?PowerWriteACValueIndex(IntPtr.Zero,ref current,ref k.sub,ref k.setting,(uint)minutes*60):PowerWriteDCValueIndex(IntPtr.Zero,ref current,ref k.sub,ref k.setting,(uint)minutes*60);if(status!=0||PowerSetActiveScheme(IntPtr.Zero,ref current)!=0||Read(current,kind,ac)!=minutes)throw new InvalidOperationException("系统策略拒绝该超时设置，请使用 Windows 设置");}
 Program.Emit(new{ok=true,active=current.ToString(),plans=plans.Select(p=>new{id=p.id.ToString(),name=p.name}),acDisplay=Read(current,"display",true),acSleep=Read(current,"sleep",true),batteryDisplay=Read(current,"display",false),batterySleep=Read(current,"sleep",false)});
 }catch(Exception e){Program.Emit(new{ok=false,reason=e.Message});}}
}
