const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { mergeHooks } = require('./companion-core.cjs');
function installHooks(bridge, home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), channel) {
  if (!fs.existsSync(bridge)) throw new Error('Windows 桥接程序尚未构建');
  const file = path.join(home, 'hooks.json');
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : {};
  const result = mergeHooks(existing, '"' + bridge + '" hook' + (channel ? ' --channel ' + channel : ''));
  const text = JSON.stringify(result, null, 2) + '\n';
  const previous = JSON.stringify(existing, null, 2) + '\n';
  if (text !== previous) {
    fs.mkdirSync(home, { recursive: true });
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.blob-pet-backup-' + Date.now());
    fs.writeFileSync(file + '.tmp', text, 'utf8');
    fs.renameSync(file + '.tmp', file);
  }
  return file;
}
function hooksInstalled() {
  try { return fs.readFileSync(path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json'), 'utf8').includes(' --blob-pet'); }
  catch { return false; }
}
module.exports = { installHooks, hooksInstalled };
