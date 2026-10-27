const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const file = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json');
if (fs.existsSync(file)) {
  const existing = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  fs.copyFileSync(file, file + '.blob-pet-backup-' + Date.now());
  for (const key of Object.keys(existing.hooks || {})) {
    existing.hooks[key] = existing.hooks[key].map(g => ({ ...g, hooks: g.hooks.filter(h => !h.command?.includes(' --blob-pet')) })).filter(g => g.hooks.length);
    if (!existing.hooks[key].length) delete existing.hooks[key];
  }
  fs.writeFileSync(file + '.tmp', JSON.stringify(existing, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
console.log('Blob Pet hooks removed; other hooks preserved.');
