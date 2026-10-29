'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runtimeDirectory } = require('./runtime.cjs');
const root = path.join(__dirname, '..');
require('./build-ui.cjs');
const output = process.env.BLOBPET_PACKAGE_OUTPUT ? path.resolve(process.env.BLOBPET_PACKAGE_OUTPUT) : path.join(root, 'dist', 'BlobPet-win32-x64');
if(path.dirname(output)!==path.join(root,'dist'))throw new Error('Package output must be a direct child of dist');
fs.mkdirSync(output, { recursive: true });
const runtime = runtimeDirectory();
const executable = path.join(output, 'BlobPet.exe');
if (fs.existsSync(executable) && fs.existsSync(path.join(output, 'version')) && fs.readFileSync(path.join(output, 'version'), 'utf8') !== fs.readFileSync(path.join(runtime, 'version'), 'utf8')) {
  throw new Error('Runtime version changed. Close the pet and choose a fresh output directory.');
}
fs.cpSync(runtime, output, { recursive: true, force: false, errorOnExist: false, filter: source => path.basename(source) !== 'electron.exe' });
const stagedExecutable = path.join(output, 'BlobPet.new.exe');
fs.copyFileSync(path.join(runtime, 'electron.exe'), stagedExecutable);
const rcedit = path.join(root,'node_modules','rcedit','bin','rcedit-x64.exe');
const iconResult = require('node:child_process').spawnSync(rcedit,[stagedExecutable,'--set-icon',path.join(root,'assets','pet-icon.ico')],{encoding:'utf8',windowsHide:true});
if(iconResult.error || iconResult.status!==0) throw new Error('EXE icon update failed: '+(iconResult.error?.message||iconResult.stderr));
fs.renameSync(stagedExecutable, executable);
const appDir = path.join(output, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });
for (const name of ['desktop', 'pet', 'replica', 'assets', 'browser']) {
  fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true });
}
const bridge = path.join(root, '.runtime', 'bridge');
if (!fs.existsSync(path.join(bridge, 'BlobPetBridge.exe'))) throw new Error('Build the Windows bridge with scripts/build-bridge.ps1 first.');
fs.cpSync(bridge, path.join(appDir, 'bridge'), { recursive: true });
const sourcePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: sourcePackage.name, version: sourcePackage.version, main: sourcePackage.main, private: true }, null, 2));
fs.copyFileSync(path.join(root, 'README.md'), path.join(output, 'README.md'));
fs.mkdirSync(path.join(output,'third-party'),{recursive:true});fs.copyFileSync(path.join(root,'third-party/CULT-UI-LICENSE.txt'),path.join(output,'third-party/CULT-UI-LICENSE.txt'));
fs.copyFileSync(path.join(root,'third-party/TAILWIND-LICENSE.txt'),path.join(output,'third-party/TAILWIND-LICENSE.txt'));
fs.copyFileSync(path.join(root,'third-party/README.md'),path.join(output,'third-party/README.md'));
const verification = path.join(root, 'docs', 'codex-companion-verification.md');
if (fs.existsSync(verification)) fs.copyFileSync(verification, path.join(output, 'VERIFICATION.md'));
fs.mkdirSync(path.join(output, 'docs'), { recursive: true });
for (const name of ['desktop-pet-verification.md', 'codex-companion-verification.md', 'netease-music-verification.md','activity-animation-verification.md','assistant-verification.md','cult-ui-verification.md']) {
  fs.copyFileSync(path.join(root, 'docs', name), path.join(output, 'docs', name));
}
fs.writeFileSync(path.join(output, '启动桌宠.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nset ELECTRON_RUN_AS_NODE=\r\nstart "" "%~dp0BlobPet.exe"\r\n');
console.log(`Packaged desktop pet: ${path.join(output, 'BlobPet.exe')}`);
