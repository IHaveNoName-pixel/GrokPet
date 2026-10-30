$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ProgressFixture {
 [StructLayout(LayoutKind.Sequential)] public struct ICC { public int size,classes; }
 [DllImport("comctl32.dll")] public static extern bool InitCommonControlsEx(ref ICC value);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr CreateWindowEx(int ex,string cls,string title,int style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,int msg,IntPtr wp,IntPtr lp);
 [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr hwnd);
}
'@
$icc=New-Object ProgressFixture+ICC
$icc.size=8;$icc.classes=32
[void][ProgressFixture]::InitCommonControlsEx([ref]$icc)
$parent=[ProgressFixture]::CreateWindowEx(0,'STATIC','GrokPet fixture - InstallShield Wizard',0x10CF0000,30,30,350,130,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero)
try {
 $bar=[ProgressFixture]::CreateWindowEx(0,'msctls_progress32','',0x50000000,20,25,290,20,$parent,[IntPtr]::Zero,[IntPtr]::Zero,[IntPtr]::Zero)
 if($bar -eq [IntPtr]::Zero){throw 'Could not create native fixture'}
 [void][ProgressFixture]::SendMessage($bar,0x406,[IntPtr]::Zero,[IntPtr]100)
 [void][ProgressFixture]::SendMessage($bar,0x402,[IntPtr]37,[IntPtr]::Zero)
 $bridge=Join-Path $PSScriptRoot '../.runtime/bridge/BlobPetBridge.exe'
 $data=(& $bridge --transfer-probe install --diagnostic | ConvertFrom-Json)
 $task=@($data.tasks | Where-Object {$_.id.StartsWith("${PID}:") -and $_.state -eq 'active'})
 if($task.Count -ne 1 -or $task[0].percent -ne 37){throw ('Native progress mismatch: '+($data | ConvertTo-Json -Depth 5 -Compress))}
 'Native vendor-named InstallShield fixture: real Win32 progress 37% passed.'
} finally {[void][ProgressFixture]::DestroyWindow($parent)}
