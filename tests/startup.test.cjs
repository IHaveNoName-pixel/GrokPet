const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createStartup} = require('../desktop/startup.cjs');
test('startup reads system state without registering automatically, and uses the packaged executable', () => {
  const writes = [];
  const app = {isPackaged:true,getLoginItemSettings:()=>({openAtLogin:true,executableWillLaunchAtLogin:false}),setLoginItemSettings:s=>writes.push(s)};
  const startup = createStartup(app,'D:\\My Pet\\BlobPet.exe','D:\\My Pet\\resources\\app');
  assert.deepEqual(startup.read(),{registered:true,enabled:false});
  assert.equal(writes.length,0);
  startup.set(true);
  assert.deepEqual(writes[0],{name:'BlobPetStudy',path:'D:\\My Pet\\BlobPet.exe',args:[],openAtLogin:true,enabled:true});
  startup.set(false);
  assert.equal(writes[1].openAtLogin,false);
  assert.throws(()=>startup.set('true'));
  assert.equal(writes.length,2);
});
