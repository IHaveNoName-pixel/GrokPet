using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Accessibility;

internal static class BaiduAccessibleProgress
{
    [DllImport("oleacc.dll")] private static extern int AccessibleObjectFromWindow(IntPtr hwnd,uint id,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out object? value);
    [DllImport("oleacc.dll")] private static extern int AccessibleChildren([MarshalAs(UnmanagedType.Interface)]object parent,int start,int count,[Out,MarshalAs(UnmanagedType.LPArray,SizeParamIndex=2)]object[] children,out int obtained);
    private const uint ClientObject=0xFFFFFFFC;
    internal static bool Paused { get; private set; }
    internal static double? Read(IntPtr handle)
    {
        Paused=false;
        Guid iid=new("618736e0-3c3d-11cf-810c-00aa00389b71");if(AccessibleObjectFromWindow(handle,ClientObject,ref iid,out object? root)!=0||root is not IAccessible acc)return null;
        var names=new List<string>();int budget=1600;Walk(acc,names,ref budget,0);
        bool resume=names.Any(s=>Regex.IsMatch(s,@"^全部开始$|^全部继续$|^开始全部$|^继续全部$"));
        bool pause=names.Any(s=>s=="全部暂停");
        bool moving=names.SelectMany(s=>Regex.Matches(s,@"(\d+(?:\.\d+)?)\s*[KMGT]?B/s",RegexOptions.IgnoreCase).Cast<Match>()).Any(m=>double.TryParse(m.Groups[1].Value,out double speed)&&speed>0);
        bool pausedText=names.Any(s=>Regex.IsMatch(s,@"^已暂停$|^暂停中$"));
        Paused=!moving&&(pausedText||resume&&!pause);
        bool downloading=names.Any(s=>Regex.IsMatch(s,@"下载中\s*[（(]\s*[1-9]\d*\s*[)）]"));if(!downloading)return null;
        for(int i=0;i<names.Count;i++){
            var m=Regex.Match(names[i],@"^当前进度\s*[：:]\s*(\d{1,3}(?:\.\d+)?)\s*%?$");
            if(m.Success&&double.TryParse(m.Groups[1].Value,out double immediate)&&immediate is >=0 and <=100)return immediate;
            if(Regex.IsMatch(names[i],@"^当前进度\s*[：:]\s*$")&&i+2<names.Count&&names[i+2].Trim()=="%"&&double.TryParse(names[i+1].Trim(),out double separate)&&separate is >=0 and <=100)return separate;
        }
        return null;
    }
    private static void Walk(IAccessible node,List<string> names,ref int budget,int depth)
    {
        if(budget<=0||depth>24)return;budget--;try{AddName(node,0,names);int count=Math.Min(node.accChildCount,Math.Min(budget,300));if(count<=0)return;object[] children=new object[count];if(AccessibleChildren(node,0,count,children,out int got)!=0)return;for(int i=0;i<got&&budget>0;i++){object child=children[i];if(child is IAccessible nested)Walk(nested,names,ref budget,depth+1);else if(child is int id){budget--;try{AddName(node,id,names);}catch{}}}}catch{}
    }
    private static void AddName(IAccessible node,int id,List<string> names) {
        string? text=node.get_accName(id);if(string.IsNullOrWhiteSpace(text)||text.Length>200)return;
        if(Regex.IsMatch(text.Trim(),@"^全部(?:开始|继续|暂停)$|^(?:开始|继续)全部$")) {
            try { if((Convert.ToInt32(node.get_accState(id))&1)!=0)return; } catch { return; }
        }
        names.Add(text.Trim());
    }
}
