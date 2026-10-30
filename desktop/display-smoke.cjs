const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
module.exports = async c => {
  if(!c.getPanel()){c.companion.snapshot.hardware={cpu:42,memory:83,gpu:19};c.companion.emit();await c.showPanel();}
  const panel=c.getPanel();
  const read=expression=>c.win.webContents.executeJavaScript(expression);
  const original=await c.win.webContents.executeJavaScript('window.pet.ready()');
  c.stopTicker();c.updateSettings({bubbles:false});
  const patch=async value=>{
    const result=await panel.webContents.executeJavaScript('window.pet.hudSettings('+JSON.stringify(value)+')');
    assert.equal(result.ok,true);await delay(70);
  };
  const selected={codex:false,network:false,vpn:false,cpu:true,memory:true,gpu:false,music:false};
  await patch({dockLayout:'list',hudMode:'always',hudFontSize:16,hudItems:selected});
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).fontSize'),'16px');
  assert.equal(await read('document.getElementById("quota-line").hidden'),true);
  assert.equal(await read('document.getElementById("network-line").hidden'),true);
  assert.doesNotMatch(await read('document.getElementById("hardware-line").textContent'),/GPU/);
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).visibility'),'visible');
  await patch({hudMode:'hover'});
  await read('dockHoverGrace.reset();window.hudExpansionPointer=null;document.body.classList.remove("hover")');
  c.win.webContents.send('pet:gaze',{x:0,y:0});await delay(70);
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).visibility'),'hidden');
  c.win.webContents.send('pet:gaze',{x:180,y:216});await delay(70);
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).visibility'),'visible');
  await patch({hudMode:'hidden'});
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).visibility'),'hidden');
  await patch({hudItems:{codex:false,network:false,vpn:false,cpu:false,memory:false,gpu:false,music:false}});
  assert.equal(await read('document.getElementById("telemetry").hidden'),true);
  await patch({hudMode:'always',hudFontSize:14,hudItems:{codex:true,network:true,vpn:true,cpu:true,memory:true,gpu:true,music:false}});
  for(const size of [96,128,160,192]) {
    c.updateSettings({size});await delay(450);
    await read('(()=>{const deck=document.getElementById("dock-card-deck"),card=document.getElementById("telemetry");deck.scrollTop+=Math.max(0,card.getBoundingClientRect().bottom-deck.getBoundingClientRect().bottom);})()');await delay(80);
    for(let settled=0;settled<30;settled++){const ready=await read('(()=>{const e=document.getElementById("telemetry"),r=e.getBoundingClientRect();return r.width>0&&r.bottom<=innerHeight;})()');if(ready)break;await read('(()=>{const deck=document.getElementById("dock-card-deck"),r=document.getElementById("telemetry").getBoundingClientRect();deck.scrollTop+=Math.max(0,r.bottom-deck.getBoundingClientRect().bottom);})()');await delay(50);}
    const rect=await read('(()=>{const r=document.getElementById("telemetry").getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:innerHeight,classes:document.body.className,hud:document.body.dataset.hudMode,dock:document.getElementById("info-dock").getBoundingClientRect().bottom,hidden:document.getElementById("telemetry").hidden,ancestors:(()=>{let n=document.getElementById("telemetry"),a=[];while(n){a.push([n.id||n.tagName,n.hidden,getComputedStyle(n).display]);n=n.parentElement;}return a;})()};})()');
    assert.ok(rect.top>=216+size/2 && rect.bottom<=rect.height && rect.left>=0 && rect.right<=360,'HUD scrolls into view below pet and stays inside window for size '+size+' '+JSON.stringify(rect));
  }
  c.updateSettings({size:128});await delay(100);
  await read('document.body.style.background="#eef1e8"');await delay(150);
  const output=path.join(c.root,'artifacts');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'hud-readable-preview.png'),(await c.win.webContents.capturePage()).toPNG());
  await read('document.body.style.background="transparent"');
  await panel.webContents.executeJavaScript('window.scrollTo(0,0)');await delay(150);
  fs.writeFileSync(path.join(output,'display-settings-panel.png'),(await require('./capture-smoke.cjs')(panel,'display panel')).toPNG());
  const p=await panel.webContents.executeJavaScript('window.pet.ready()');
  assert.equal(typeof p.startup.enabled,'boolean');
  assert.equal(await panel.webContents.executeJavaScript('!!document.getElementById("start-at-login")'),true);
  const invalid=await panel.webContents.executeJavaScript('window.pet.startup("invalid")');
  assert.ok(invalid.error,'invalid startup payload rejected without writing OS settings');
  // Exercise the real expandable dock, with deterministic data and no external actions.
  c.stopTicker();c.updateSettings({size:192,hudMode:'always',musicEnabled:true,hudFontSize:16,hudItems:{cpu:true,memory:true,gpu:true,codex:true,network:true,vpn:true,music:true}});
  const fixture={hardware:{cpu:42,memory:83,gpu:19,memoryUsedBytes:28*1024**3,memoryTotalBytes:32*1024**3,gpuDedicatedBytes:3*1024**3},quota:{status:'ready',buckets:[{id:'codex',windows:[{minutes:300,remaining:52},{minutes:10080,remaining:56}]}]},network:{status:'ready',download:20480,upload:3072,tunnels:['test']},media:{status:'ready',title:'桌宠音乐联动',artist:'本地测试数据',state:'paused'}};
  await read('stats('+JSON.stringify(fixture)+')');await delay(750);
  const measure=()=>read('(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {music:box("music-controls"),actions:box("quick-form"),deck:box("dock-card-deck"),card:box("telemetry"),height:innerHeight,classes:document.body.className,hud:document.body.dataset.hudMode,dock:document.getElementById("info-dock").getBoundingClientRect().bottom,hidden:document.getElementById("telemetry").hidden,ancestors:(()=>{let n=document.getElementById("telemetry"),a=[];while(n){a.push([n.id||n.tagName,n.hidden,getComputedStyle(n).display]);n=n.parentElement;}return a;})()};})()');
  await read('(()=>{const deck=document.getElementById("dock-card-deck"),card=document.getElementById("telemetry");deck.scrollTop+=Math.max(0,card.getBoundingClientRect().bottom-deck.getBoundingClientRect().bottom);})()');let g=await measure();assert.equal(await read('document.getElementById("dock-card-deck").contains(quickForm)'),true,'conversation participates in the scrollable card collection');assert.ok(g.card.bottom<=g.height,'collapsed card fits at maximum pet size');
  await read('document.body.style.background="#eef1f6"');
  fs.writeFileSync(path.join(output,'system-card-collapsed.png'),(await require('./capture-smoke.cjs')(c.win,'collapsed system card')).toPNG());
  // System details now open as the same-window orbit rather than the old inline list.
  await require('./system-orbit-smoke.cjs')(c);
  c.updateSettings(original);c.startTicker();
  fs.writeFileSync(path.join(output,'display-report.json'),JSON.stringify({passed:true,checks:['14/16 px font','selective content','hover in/out','always visible','permanent hiding','all items off','four pet sizes fit','startup state read and invalid input rejected; OS startup not changed']},null,2));
};



