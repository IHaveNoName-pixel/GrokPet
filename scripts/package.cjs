'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runtimeDirectory } = require('./runtime.cjs');
const root = path.join(__dirname, '..');
const output = path.join(root, 'dist', 'BlobPet-win32-x64');
fs.mkdirSync(output, { recursive: true });
const runtime = runtimeDirectory();
const executable = path.join(output, 'BlobPet.exe');
if (fs.existsSync(executable) && fs.existsSync(path.join(output, 'version')) && fs.readFileSync(path.join(output, 'version'), 'utf8') !== fs.readFileSync(path.join(runtime, 'version'), 'utf8')) {
  throw new Error('Runtime version changed. Close the pet and choose a fresh output directory.');
}
fs.cpSync(runtime, output, { recursive: true, filter: source => path.basename(source) !== 'electron.exe' });
if (!fs.existsSync(executable)) fs.copyFileSync(path.join(runtime, 'electron.exe'), executable);
const appDir = path.join(output, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });
for (const name of ['desktop', 'pet', 'replica', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true });
}
const bridge = path.join(root, '.runtime', 'bridge');
if (!fs.existsSync(path.join(bridge, 'BlobPetBridge.exe'))) throw new Error('Build the Windows bridge with scripts/build-bridge.ps1 first.');
fs.cpSync(bridge, path.join(appDir, 'bridge'), { recursive: true });
const sourcePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: sourcePackage.name, version: sourcePackage.version, main: sourcePackage.main, private: true }, null, 2));
fs.copyFileSync(path.join(root, 'README.md'), path.join(output, 'README.md'));
const verification = path.join(root, 'docs', 'desktop-pet-verification.md');
if (fs.existsSync(verification)) fs.copyFileSync(verification, path.join(output, 'VERIFICATION.md'));
fs.writeFileSync(path.join(output, '启动桌宠.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nset ELECTRON_RUN_AS_NODE=\r\nstart "" "%~dp0BlobPet.exe"\r\n');
console.log(`Packaged desktop pet: ${path.join(output, 'BlobPet.exe')}`);
