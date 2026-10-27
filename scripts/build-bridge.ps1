$ErrorActionPreference = 'Stop'
$petRoot = Split-Path -Parent $PSScriptRoot
dotnet build (Join-Path $petRoot 'native/BlobPetBridge/BlobPetBridge.csproj') -c Release -o (Join-Path $petRoot '.runtime/bridge') -p:NuGetAudit=false --ignore-failed-sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
