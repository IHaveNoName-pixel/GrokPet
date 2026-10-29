using System.Runtime.InteropServices;
internal static class MasterVolume {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] private class Enumerator{}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] private interface IDevices{void EnumAudioEndpoints(int f,uint m,out IntPtr d);void GetDefaultAudioEndpoint(int f,int r,out IDevice d);}
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] private interface IDevice{void Activate(ref Guid id,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object value);}
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] private interface IVolume{
 void RegisterControlChangeNotify(IntPtr p);void UnregisterControlChangeNotify(IntPtr p);void GetChannelCount(out uint count);
 void SetMasterVolumeLevel(float level,ref Guid context);void SetMasterVolumeLevelScalar(float level,ref Guid context);void GetMasterVolumeLevel(out float level);void GetMasterVolumeLevelScalar(out float level);
 void SetChannelVolumeLevel(uint channel,float level,ref Guid context);void SetChannelVolumeLevelScalar(uint channel,float level,ref Guid context);void GetChannelVolumeLevel(uint channel,out float level);void GetChannelVolumeLevelScalar(uint channel,out float level);void SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,ref Guid context);void GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
 }
 internal static void Run(string action){object enumerator=new Enumerator();object? endpoint=null,volume=null;try{((IDevices)enumerator).GetDefaultAudioEndpoint(0,1,out IDevice d);endpoint=d;Guid id=typeof(IVolume).GUID;d.Activate(ref id,23,IntPtr.Zero,out object v);volume=v;var control=(IVolume)v;if(action!="get"){if(!int.TryParse(action,out int value)||value<0||value>100)throw new ArgumentException("Invalid volume");Guid context=Guid.Empty;control.SetMasterVolumeLevelScalar(value/100f,ref context);}control.GetMasterVolumeLevelScalar(out float level);control.GetMute(out bool muted);Program.Emit(new{ok=true,volume=(int)Math.Round(level*100),muted});}finally{foreach(var v in new[]{volume,endpoint,enumerator})if(v!=null&&Marshal.IsComObject(v))Marshal.ReleaseComObject(v);}}
}
