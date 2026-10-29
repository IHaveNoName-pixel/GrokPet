using System.Runtime.InteropServices;

internal static class AudioPeak
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] private class Enumerator { }
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDevices {
        void EnumAudioEndpoints(int flow,uint mask,out IDeviceCollection devices);
        void GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
    }
    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDeviceCollection { void GetCount(out uint count);void Item(uint index,out IDevice device); }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDevice { void Activate(ref Guid iid,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object value); }
    [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMeter { void GetPeakValue(out float peak); }
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IManager {
        void GetAudioSessionControl(ref Guid id,uint flags,out IntPtr control);
        void GetSimpleAudioVolume(ref Guid id,uint flags,out IntPtr volume);
        void GetSessionEnumerator(out ISessions sessions);
    }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISessions { void GetCount(out int count);void GetSession(int index,[MarshalAs(UnmanagedType.IUnknown)]out object session); }
    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IControl {
        void GetState(out int state);
        void GetDisplayName([MarshalAs(UnmanagedType.LPWStr)]out string name);
        void SetDisplayName([MarshalAs(UnmanagedType.LPWStr)]string name,ref Guid context);
        void GetIconPath([MarshalAs(UnmanagedType.LPWStr)]out string path);
        void SetIconPath([MarshalAs(UnmanagedType.LPWStr)]string path,ref Guid context);
        void GetGroupingParam(out Guid id);void SetGroupingParam(ref Guid id,ref Guid context);
        void RegisterAudioSessionNotification(IntPtr value);void UnregisterAudioSessionNotification(IntPtr value);
        void GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)]out string id);
        void GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)]out string id);
        void GetProcessId(out uint id);
    }
    internal static void Run(bool once)
    {
        float envelope=0.02f;
        do {
            object? enumerator=null;var owned=new List<object>();var meters=new List<object>();
            try {
                enumerator=new Enumerator();((IDevices)enumerator).EnumAudioEndpoints(0,1,out IDeviceCollection devices);owned.Add(devices);devices.GetCount(out uint deviceCount);
                for(uint d=0;d<deviceCount;d++){devices.Item(d,out IDevice endpoint);owned.Add(endpoint);
                Guid iid=typeof(IManager).GUID;endpoint.Activate(ref iid,23,IntPtr.Zero,out object value);object manager=value;owned.Add(manager);
                ((IManager)manager).GetSessionEnumerator(out ISessions list);owned.Add(list);list.GetCount(out int count);
                for(int i=0;i<count;i++){list.GetSession(i,out object session);bool keep=false;try{((IControl)session).GetProcessId(out uint pid);((IControl)session).GetState(out int state);using var process=System.Diagnostics.Process.GetProcessById((int)pid);if(process.ProcessName.StartsWith("cloudmusic",StringComparison.OrdinalIgnoreCase)&&state==1&&session is IMeter){meters.Add(session);keep=true;}}catch{}finally{if(!keep)Marshal.ReleaseComObject(session);}}
                }
                for(int i=0;i<(once?1:40);i++) { float peak=0;foreach(var meter in meters){try{((IMeter)meter).GetPeakValue(out float current);peak=Math.Max(peak,current);}catch{}}if(!float.IsFinite(peak))peak=0;peak=Math.Max(0,peak);envelope=Math.Max(0.002f,Math.Max(peak,envelope*0.985f));Program.Emit(new {kind="audioPeak",peak=peak/(envelope*0.6f+peak),source="netease",sessions=meters.Count});if(!once)Thread.Sleep(50); }
            } catch { Program.Emit(new {kind="audioPeak",peak=(float?)null});if(!once)Thread.Sleep(2000); }
            finally {foreach(object value in meters)Marshal.ReleaseComObject(value);foreach(object? value in owned.AsEnumerable().Reverse().Concat(new[]{enumerator}))if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
        } while(!once);
    }
}
