param([ValidateSet('right','escape')][string]$Action,[int]$X=0,[int]$Y=0)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class PetPointerProbe {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
if($Action -eq 'right'){
 [PetPointerProbe]::SetCursorPos($X,$Y) | Out-Null
 Start-Sleep -Milliseconds 120
 [PetPointerProbe]::mouse_event(8,0,0,0,[UIntPtr]::Zero)
 [PetPointerProbe]::mouse_event(16,0,0,0,[UIntPtr]::Zero)
}else{
 [PetPointerProbe]::keybd_event(27,0,0,[UIntPtr]::Zero)
 [PetPointerProbe]::keybd_event(27,0,2,[UIntPtr]::Zero)
}
