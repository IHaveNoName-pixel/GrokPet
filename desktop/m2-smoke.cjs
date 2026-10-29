const assert=require('node:assert/strict');const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{c.stopTicker();const read=s=>c.win.webContents.executeJavaScript(s);for(let i=0;i<40&&!await read('!!bot');i++)await wait(50);c.getPetAssistant().send=async()=>{throw Error('must stay local')};
for(const text of ['查询系统状态','查询音量','打开 未配置的验收目标']){const r=await read('window.pet.assistantAction('+JSON.stringify({type:'send',mode:'api',text})+')');if(text.startsWith('打开'))assert.match(r.error,/未配置/);else {assert.equal(r.local,true);assert.ok(r.message);}}
const r=await read('window.pet.systemCommand({type:"volume",action:"get"})');assert.equal(r.ok,true);const invalid=await read('window.pet.systemCommand({type:"volume",action:"set",value:101})');assert.ok(invalid.error);
await c.showPanel();await wait(200);const panel=c.getPanel();assert.ok(await panel.webContents.executeJavaScript('!!document.getElementById("launch-add")&&!!document.getElementById("volume-set")'));assert.ok(Array.isArray((await read('window.pet.launchTargets()')).items));
await wait(500);require('node:fs').writeFileSync(require('node:path').join(c.root,'artifacts','m2-settings.png'),(await panel.webContents.capturePage()).toPNG());
console.log('M2 local routing without model calls, real volume query, unknown target rejection and settings controls passed');};
