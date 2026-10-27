const fs = require('node:fs');
const path = require('node:path');
function runtimeDirectory() {
  const root = path.join(__dirname, '..');
  const candidates = [path.join(root, 'node_modules/electron/dist'), path.join(root, '.runtime/electron')];
  const found = candidates.find(p => fs.existsSync(path.join(p, 'electron.exe')));
  if (!found) throw new Error('Electron runtime missing. Run npm install first.');
  return found;
}
module.exports = { runtimeDirectory };
