const { spawn } = require('node:child_process');
const path = require('node:path');
const { runtimeDirectory } = require('./runtime.cjs');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes('--packaged');
const root = path.join(__dirname, '..');
const executable = packaged ? path.join(root, 'dist/BlobPet-win32-x64/BlobPet.exe') : path.join(runtimeDirectory(), 'electron.exe');
const baseArgs = packaged ? [] : [root];
function run(reopen) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...baseArgs, '--pet-smoke', ...(reopen ? ['--pet-smoke-reopen'] : [])], { env, stdio: 'inherit', windowsHide: true });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Smoke timed out')); }, 50000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Smoke exited ${code}`)); });
  });
}
(async () => { await run(false); await run(true); })().catch(error => { console.error(error); process.exitCode = 1; });
