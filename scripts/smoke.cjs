const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const { runtimeDirectory } = require('./runtime.cjs');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes('--packaged');
const musicOnly=process.argv.includes('--music-only');
const assistantOnly=process.argv.includes('--assistant-only');
const root = path.join(__dirname, '..');
const executable = packaged ? path.join(process.env.BLOBPET_PACKAGE_OUTPUT || path.join(root, 'dist/BlobPet-win32-x64'), 'BlobPet.exe') : path.join(runtimeDirectory(), 'electron.exe');
const baseArgs = packaged ? [] : [root];
function run(reopen) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...baseArgs, ...(process.env.BLOBPET_TEST_SCALE?['--force-device-scale-factor='+process.env.BLOBPET_TEST_SCALE]:[]), '--pet-smoke', ...(assistantOnly?['--pet-assistant-smoke']:[]), ...(musicOnly?['--pet-music-smoke']:[]), ...(reopen ? ['--pet-smoke-reopen'] : [])], { env, stdio: 'inherit', windowsHide: true });
    const timeout = setTimeout(() => {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide:true,stdio:'ignore'});
      else child.kill();
      reject(new Error('Smoke timed out'));
    }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Smoke exited ${code}`)); });
  });
}
(async () => { await run(false); if(!musicOnly&&!assistantOnly)await run(true); })().catch(error => { console.error(error); process.exitCode = 1; });
