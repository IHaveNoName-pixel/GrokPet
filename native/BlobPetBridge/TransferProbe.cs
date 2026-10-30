using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Windows.Automation;

internal static class TransferProbe
{
    internal static string? Classify(string processName,string title)
    {
        string pn=processName.ToLowerInvariant();
        if(pn=="thunder")return "thunder";
        if(pn is "baidunetdisk" or "baidunetdiskunite")return "baidu";
        if(Regex.IsMatch(title,@"卸载|uninstall",RegexOptions.IgnoreCase))return null;
        bool installerProcess=Regex.IsMatch(pn,@"(?:^msiexec$|setup|installer|^install$)");
        bool installerWizard=Regex.IsMatch(title,@"InstallShield\s+Wizard|安装向导|Setup\s+Wizard|Windows\s+Installer",RegexOptions.IgnoreCase);
        return installerWizard||(installerProcess&&Regex.IsMatch(title,@"安装|setup|install",RegexOptions.IgnoreCase))?"install":null;
    }
    internal static void Run(string[] args)
    {
        int classify=Array.IndexOf(args,"--classify");
        if(classify>=0){Program.Emit(new {source=classify+2<args.Length?Classify(args[classify+1],args[classify+2]):null});return;}
        var enabled=new HashSet<string>(args.Where(x=>x is "thunder" or "baidu" or "install"));
        var found=new List<object>();var available=new HashSet<string>();
        foreach(var process in Process.GetProcesses())
        {
            using(process){
            try{
                var handle=process.MainWindowHandle;if(handle==IntPtr.Zero)continue;
                var title=process.MainWindowTitle??"";
                string? source=Classify(process.ProcessName,title);
                if(source is null||!enabled.Contains(source))continue;
                available.Add(source);
                if(source=="baidu"){
                    double? overall=BaiduAccessibleProgress.Read(handle);
                    if(args.Contains("--diagnostic"))Console.Error.WriteLine("Baidu accessibility "+(overall.HasValue?"progress":"unavailable"));
                    if(overall.HasValue)found.Add(new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:aggregate",state=BaiduAccessibleProgress.Paused?"paused":"active",name="百度网盘传输总进度",percent=overall});
                    continue;
                }
                object? fallback=null;
                if(source=="install"){fallback=new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:window",state="unknown",name="安装窗口（进度未知）",percent=(double?)null};found.Add(fallback);}
                if(source=="install"){
                    var classic=InstallerProgress.Read(handle,args.Contains("--diagnostic"));
                    if(classic.Count>0){foreach(var progress in classic)found.Add(new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:native:{progress.Handle.ToInt64()}",state="active",name="软件安装",percent=progress.Percent});if(fallback!=null)found.Remove(fallback);continue;}
                }
                if(args.Contains("--diagnostic"))Console.Error.WriteLine("UIA start "+source);
                var root=AutomationElement.FromHandle(handle);if(root==null)continue;
                if(args.Contains("--diagnostic"))Console.Error.WriteLine("UIA root "+source);
                var bars=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.ProgressBar));
                if(args.Contains("--diagnostic"))Console.Error.WriteLine("UIA scan complete "+source+" "+bars.Count);
                int detected=0;
                for(int i=0;i<Math.Min(bars.Count,30);i++){
                    var bar=bars[i];if(bar.Current.IsOffscreen)continue;
                    if(source!="install"){
                        string context=bar.Current.Name??"";var parent=TreeWalker.ControlViewWalker.GetParent(bar);if(parent!=null)context+=" "+parent.Current.Name;
                        if(!Regex.IsMatch(context,@"下载|downloading|download",RegexOptions.IgnoreCase))continue;
                    }
                    double? percent=null;
                    if(bar.TryGetCurrentPattern(RangeValuePattern.Pattern,out object value)){
                        var range=((RangeValuePattern)value).Current;double span=range.Maximum-range.Minimum;
                        if(double.IsFinite(span)&&span>0&&double.IsFinite(range.Value)&&range.Value>=range.Minimum&&range.Value<=range.Maximum)percent=(range.Value-range.Minimum)/span*100;
                    }
                    found.Add(new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:{i}",state="active",name=source=="install"?"软件安装":source=="thunder"?"迅雷下载":"百度网盘下载",percent});detected++;
                }
                if(detected>0&&fallback!=null)found.Remove(fallback);
            }catch { }
            }
        }
        Program.Emit(new {kind="transferProbe",available=available.ToArray(),tasks=found});
    }
}
