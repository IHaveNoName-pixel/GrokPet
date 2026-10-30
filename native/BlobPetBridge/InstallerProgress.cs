using System.Runtime.InteropServices;
using System.Text;

// Read-only fallback for classic InstallShield controls that do not expose UIA ranges.
internal static class InstallerProgress
{
    private delegate bool EnumProc(IntPtr hwnd,IntPtr param);
    [DllImport("user32.dll")]private static extern bool EnumChildWindows(IntPtr parent,EnumProc callback,IntPtr param);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)]private static extern int GetClassName(IntPtr hwnd,StringBuilder name,int max);
    [DllImport("user32.dll")]private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll",SetLastError=true)]private static extern IntPtr SendMessageTimeout(IntPtr hwnd,uint message,IntPtr wParam,IntPtr lParam,uint flags,uint timeout,out UIntPtr result);
    [DllImport("user32.dll",EntryPoint="GetWindowLongW")]private static extern int GetWindowLong(IntPtr hwnd,int index);
    internal static List<(IntPtr Handle,double? Percent)> Read(IntPtr parent,bool diagnostic=false)
    {
        var result=new List<(IntPtr,double?)>();
        EnumChildWindows(parent,(hwnd,_)=>{
            var name=new StringBuilder(128);GetClassName(hwnd,name,name.Capacity);
            if(!name.ToString().Equals("msctls_progress32",StringComparison.OrdinalIgnoreCase)||!IsWindowVisible(hwnd))return true;
            if(diagnostic)Console.Error.WriteLine("Classic installer progress control found");
            // PBS_MARQUEE carries activity but no reliable percentage.
            if((GetWindowLong(hwnd,-16)&8)!=0){result.Add((hwnd,null));return result.Count<30;}
            bool Read(uint message,int parameter,out long value){bool ok=SendMessageTimeout(hwnd,message,new IntPtr(parameter),IntPtr.Zero,2,100,out var raw)!=IntPtr.Zero;value=unchecked((long)raw.ToUInt64());return ok;}
            if(Read(0x407,1,out var min)&&Read(0x407,0,out var max)&&Read(0x408,0,out var pos)&&max>min&&pos>=min&&pos<=max)result.Add((hwnd,(pos-min)*100.0/(max-min)));
            else if(diagnostic)Console.Error.WriteLine("Classic installer progress access unavailable");
            return result.Count<30;
        },IntPtr.Zero);
        return result;
    }
}
