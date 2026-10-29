using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Windows.Automation;

internal static class TransferProbe
{
    internal static void Run(string[] args)
    {
        var enabled=new HashSet<string>(args.Where(x=>x is "thunder" or "baidu" or "install"));
        var found=new List<object>();var available=new HashSet<string>();
        foreach(var process in Process.GetProcesses())
        {
            using(process){
            try{
                string pn=process.ProcessName.ToLowerInvariant();string? source=pn=="thunder"?"thunder":(pn=="baidunetdisk"||pn=="baidunetdiskunite")?"baidu":Regex.IsMatch(pn,@"(?:^msiexec$|setup|installer|^install$)")?"install":null;
                if(source is null||!enabled.Contains(source))continue;
                var handle=process.MainWindowHandle;if(handle==IntPtr.Zero)continue;
                var title=process.MainWindowTitle??"";
                if(source=="install"&&(!Regex.IsMatch(title,@"安装|setup|install",RegexOptions.IgnoreCase)||Regex.IsMatch(title,@"卸载|uninstall",RegexOptions.IgnoreCase)))continue;
                available.Add(source);
                if(source=="baidu"){
                    double? overall=BaiduAccessibleProgress.Read(handle);
                    if(args.Contains("--diagnostic"))Console.Error.WriteLine("Baidu accessibility "+(overall.HasValue?"progress":"unavailable"));
                    if(overall.HasValue)found.Add(new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:aggregate",state=BaiduAccessibleProgress.Paused?"paused":"active",name="百度网盘传输总进度",percent=overall});
                    continue;
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
                if(source=="install"&&detected==0)found.Add(new {kind="transfer",source,id=$"{process.Id}:{handle.ToInt64()}:window",state="unknown",name="安装窗口",percent=(double?)null});
            }catch { }
            }
        }
        Program.Emit(new {kind="transferProbe",available=available.ToArray(),tasks=found});
    }
}
