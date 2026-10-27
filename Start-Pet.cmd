@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "dist\BlobPet-win32-x64\BlobPet.exe" (
  start "" "dist\BlobPet-win32-x64\BlobPet.exe"
  exit /b
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required for source launch. Use the packaged BlobPet.exe instead.
  pause
  exit /b 1
)
node scripts\start.cjs
if errorlevel 1 pause
