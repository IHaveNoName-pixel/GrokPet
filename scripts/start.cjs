const { spawn } = require('node:child_process');
const path = require('node:path');
require('./build-ui.cjs');
const { runtimeDirectory } = require('./runtime.cjs');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.join(runtimeDirectory(), 'electron.exe'), [path.join(__dirname, '..'), ...process.argv.slice(2)], {
  env, stdio: 'inherit', windowsHide: true,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
