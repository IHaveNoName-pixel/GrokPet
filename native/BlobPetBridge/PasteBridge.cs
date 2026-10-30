using System.Runtime.InteropServices;
using System.Text;

// Only window identity is observed. No window title, input text or key history is read.
internal static class PasteBridge
{
    internal static void SelfTest(int owner)
    {
        bool received=false;object? result=null;
        var window=new System.Windows.Window{Title="GrokPet paste validation",Width=260,Height=100,WindowStartupLocation=System.Windows.WindowStartupLocation.CenterScreen};
        window.PreviewKeyDown+=(_,e)=>{if(e.Key==System.Windows.Input.Key.V&&(System.Windows.Input.Keyboard.Modifiers&System.Windows.Input.ModifierKeys.Control)!=0)received=true;e.Handled=true;};
        var start=new System.Windows.Controls.Button{Content="验证粘贴按键"};window.Content=start;
        start.Click+=async(_,_)=>{start.IsEnabled=false;await Task.Delay(150);var handle=new System.Windows.Interop.WindowInteropHelper(window).Handle;result=await Task.Run(()=>Paste(handle.ToString(),Environment.ProcessId.ToString(),owner));await Task.Delay(250);window.Close();};
        window.Loaded+=async(_,_)=>{await Task.Delay(500);ShowWindow(new System.Windows.Interop.WindowInteropHelper(window).Handle,5);};
        var timeout=new System.Windows.Threading.DispatcherTimer{Interval=TimeSpan.FromSeconds(45)};timeout.Tick+=(_,_)=>window.Close();timeout.Start();
        window.ShowDialog();timeout.Stop();Program.Emit(new{kind="paste-test",received,result});
    }
    [DllImport("user32.dll")] static extern bool ShowWindow(nint window,int command);
    [DllImport("user32.dll")] static extern nint GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(nint window, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindow(nint window);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(nint window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(nint window, StringBuilder name,int size);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(nint window);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count, INPUT[] input,int size);
    delegate void ForegroundEvent(nint hook,uint evt,nint window,int obj,int child,uint thread,uint time);
    [DllImport("user32.dll")] static extern nint SetWinEventHook(uint first,uint last,nint module,ForegroundEvent callback,uint process,uint thread,uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(nint hook);
    [DllImport("user32.dll")] static extern int GetMessage(out MESSAGE message,nint window,uint min,uint max);
    [DllImport("user32.dll")] static extern bool TranslateMessage(ref MESSAGE message);
    [DllImport("user32.dll")] static extern nint DispatchMessage(ref MESSAGE message);
    [StructLayout(LayoutKind.Sequential)] struct MESSAGE {public nint window;public uint message;public nuint wParam;public nint lParam;public uint time;public int x,y;public uint extra;}
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public KEYBOARD keyboard; [FieldOffset(0)] public MOUSE mouse; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBOARD { public ushort key,scan; public uint flags,time; public nuint extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSE { public int x,y;public uint data,flags,time; public nuint extra; }
    internal static void Watch(int owner)
    {
        void Observe(nint window){if(window==0)return;GetWindowThreadProcessId(window,out var pid);var cls=new StringBuilder(128);GetClassName(window,cls,cls.Capacity);if(pid>0&&pid!=owner&&IsWindowVisible(window)&&cls.ToString() is not "Progman" and not "WorkerW")Program.Emit(new{kind="foreground",handle=window.ToString(),pid});}
        ForegroundEvent callback=(_,_,window,_,_,_,_)=>Observe(window);
        var hook=SetWinEventHook(3,3,0,callback,0,0,0);if(hook==0)return;
        try{Observe(GetForegroundWindow());while(GetMessage(out var message,0,0,0)>0){TranslateMessage(ref message);DispatchMessage(ref message);}}
        finally{UnhookWinEvent(hook);GC.KeepAlive(callback);}
    }
    internal static object Paste(string handle,string targetPid,int owner)
    {
        if(!long.TryParse(handle,out var raw)||!uint.TryParse(targetPid,out var expected)||expected==0||expected==owner||owner<=0)return new{pasted=false,message="粘贴目标无效，已复制，可手动粘贴"};
        nint window=(nint)raw;GetWindowThreadProcessId(window,out var pid);
        if(!IsWindow(window)||!IsWindowVisible(window)||pid!=expected)return new{pasted=false,message="原窗口已关闭，已复制，可手动粘贴"};
        var foreground=GetForegroundWindow();GetWindowThreadProcessId(foreground,out var current);
        if(current!=owner&&foreground!=window)return new{pasted=false,message="前台窗口已改变，已复制，可手动粘贴"};
        if(new[]{0x10,0x11,0x12,0x5B,0x5C}.Any(k=>(GetAsyncKeyState(k)&0x8000)!=0))return new{pasted=false,message="请松开修饰键后再点击，内容已复制"};
        SetForegroundWindow(window);Thread.Sleep(80);
        if(GetForegroundWindow()!=window)return new{pasted=false,message="无法激活原窗口，已复制，可手动粘贴"};
        INPUT Key(ushort key,bool up)=>new(){type=1,data=new(){keyboard=new(){key=key,flags=up?2u:0u}}};
        var sent=SendInput(4,new[]{Key(0x11,false),Key(0x56,false),Key(0x56,true),Key(0x11,true)},Marshal.SizeOf<INPUT>());
        // Release only keys this operation pressed if Windows accepted a partial sequence.
        if(sent>0&&sent<4)SendInput(2,new[]{Key(0x56,true),Key(0x11,true)},Marshal.SizeOf<INPUT>());
        return new{pasted=sent==4,message=sent==4?"已发送粘贴到原窗口":"目标窗口未接受粘贴，已复制，可手动粘贴"};
    }
}
