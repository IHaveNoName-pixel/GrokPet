$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$output=Join-Path $root 'vscode/GrokPet-work-bridge.vsix'
Add-Type -AssemblyName System.IO.Compression
$stream=[IO.File]::Open($output,[IO.FileMode]::Create)
$zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
function Add-Text($name,$value){$entry=$zip.CreateEntry($name);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write($value)}finally{$writer.Dispose()}}
try {
 Add-Text '[Content_Types].xml' '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="md" ContentType="text/plain"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>'
 Add-Text 'extension.vsixmanifest' '<?xml version="1.0"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="grokpet-work-bridge" Version="0.1.0" Publisher="grokpet-local"/><DisplayName>GrokPet Work Bridge</DisplayName><Description xml:space="preserve">Local project diagnostics and debug summary bridge.</Description><Tags>grokpet</Tags><Categories>Other</Categories><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.85.0"/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>'
 foreach($name in @('package.json','extension.cjs','README.md')){Add-Text ('extension/'+$name) (Get-Content -LiteralPath (Join-Path $root ('vscode/extension/'+$name)) -Raw)}
} finally {$zip.Dispose();$stream.Dispose()}
Write-Output "VS Code extension built: $output"
