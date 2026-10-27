const path = require('node:path');
const { installHooks } = require('../desktop/hook-config.cjs');
const crypto = require('node:crypto');
const bridge = process.argv[2] || path.join(__dirname, '../dist/BlobPet-win32-x64/resources/app/bridge/BlobPetBridge.exe');
const absolute = path.resolve(bridge);
const channel = crypto.createHash('sha256').update(path.dirname(path.dirname(absolute)).toLowerCase()).digest('hex').slice(0, 12);
console.log(installHooks(absolute, undefined, channel));
