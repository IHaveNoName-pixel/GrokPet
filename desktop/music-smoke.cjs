const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
  // A closed settings window must not break IPC from the still-live pet.
  assert.ok(await c.win.webContents.executeJavaScript('window.pet.ready()'));
  await c.showPanel();const panel=c.getPanel();
  const read=e=>c.win.webContents.executeJavaScript(e);const panelRead=e=>panel.webContents.executeJavaScript(e);
  const previous=await read('window.pet.ready()');
  c.updateSettings({musicEnabled:true,musicLyrics:true,musicBubbles:false,bubbles:true,hudMode:'always',hudFontSize:14,hudItems:{codex:false,network:false,vpn:false,cpu:false,memory:false,gpu:false,music:true}});
  c.setPaused(false);c.brain.until=0;c.companion.activity.tasks.clear();c.companion.activity.celebrateUntil=0;
  c.companion.snapshot.hardware.animation=null;c.companion.snapshot.hardware.level='normal';c.companion.queue.queue=[];
  const media={kind:'media',status:'ready',source:'cloudmusic.exe',title:'本地联动测试',artist:'示例歌手',state:'playing',positionMs:null,durationMs:0,observedAt:Date.now()};
  c.companion.receive(media);c.tick();await delay(150);
  assert.equal(await read('bot.state'),'dictating');
  assert.equal(await read('document.body.classList.contains("music-active")'),true);
  assert.match(await panelRead('document.getElementById("music-time").textContent'),/未提供时间轴/);
  assert.equal(await panelRead('document.getElementById("music-progress").hidden'),true);
  const file=path.join(c.dataDir,'music-smoke.lrc');fs.writeFileSync(file,'[00:01.00]本地测试第一句\n[00:03.00]本地测试第二句\n');
  c.companion.importLyrics(file,c.companion.music.view().trackKey);
  await read('clearTimeout(bubbleTimer);bubbleUntil=0;lastLyricKey=null;');
  const result=await panelRead('window.pet.musicCalibrate(1100)');assert.equal(result.ok,true);await delay(150);
  assert.match(await read('document.getElementById("bubble").textContent'),/本地测试第一句/);
  assert.match(await panelRead('document.getElementById("music-time").textContent'),/手动同步/);
  c.companion.receive({...media,state:'paused',observedAt:Date.now()});c.tick();await delay(100);
  const frozen=c.companion.music.view().positionMs;await delay(100);
  assert.equal(c.companion.music.view().positionMs,frozen);
  assert.notEqual(await read('bot.state'),'dictating');
  c.companion.receive({...media,observedAt:Date.now()});
  await read('bubbleUntil=0;lastLyricKey=null;');await panelRead('window.pet.musicCalibrate(3100)');c.tick();await delay(150);
  assert.match(await read('document.getElementById("bubble").textContent'),/本地测试第二句/);
  const originalControl=c.companion.controlMedia;const actions=[];
  c.companion.controlMedia=async action=>{actions.push(action);return {ok:true};};
  try{
    for(const action of ['previous','toggle','next']){
      await read('document.querySelector(\'[data-music="'+action+'"]\').click()');await delay(80);
    }
    assert.deepEqual(actions,['previous','toggle','next'],'real renderer buttons reach trusted IPC and companion');
  }finally{c.companion.controlMedia=originalControl;}
  await panelRead('window.pet.musicCalibrate(3100)');
  c.updateSettings({size:192,hudFontSize:16,hudItems:{codex:true,network:true,vpn:true,cpu:true,memory:true,gpu:true,music:true}});await delay(600);
  const geometry=await read('(()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {pet:box("pet-hit"),dock:box("info-dock"),bubble:box("bubble"),height:innerHeight};})()');
  assert.ok(geometry.dock.top>geometry.pet.bottom&&geometry.dock.bottom<=geometry.height,'four HUD rows at largest font and pet size fit below pet');
  assert.ok(geometry.bubble.bottom<geometry.pet.top,'lyric stays above pet, clear of bottom information and controls');
  assert.equal(await read('getComputedStyle(document.getElementById("telemetry")).visibility'),'visible','information remains visible alongside message bubble');
  c.stopTicker();
  c.updateSettings({hudMode:'hover'});c.win.webContents.send('pet:gaze',{x:180,y:216});await delay(80);
  c.win.webContents.send('pet:gaze',{x:180,y:320});await delay(80);
  assert.equal(await read('document.body.classList.contains("hover")'),true,'moving toward controls preserves hover');
  c.win.webContents.send('pet:gaze',{x:0,y:0});await delay(80);
  assert.equal(await read('getComputedStyle(document.getElementById("music-controls")).visibility'),'visible','short exit retains dock during hover grace');await delay(3300);c.win.webContents.send('pet:gaze',{x:0,y:0});await delay(80);
  assert.equal(await read('getComputedStyle(document.getElementById("music-controls")).visibility'),'hidden');
  c.updateSettings({hudMode:'always'});c.startTicker();
  await read('document.body.style.background="#eef1e8"');await delay(150);
  const output=path.join(c.root,'artifacts');fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'music-pet-preview.png'),(await require('./capture-smoke.cjs')(c.win,'music pet')).toPNG());
  await read('document.body.style.background="transparent"');
  await panelRead('document.getElementById("music-section").scrollIntoView()');await delay(150);
  fs.writeFileSync(path.join(output,'music-panel.png'),(await require('./capture-smoke.cjs')(panel,'music panel')).toPNG());
  c.win.webContents.send('pet:notice',{source:'Codex',title:'需要你处理',body:'优先级测试'});await delay(100);
  await panelRead('window.pet.musicCalibrate(1100)');await delay(100);
  assert.match(await read('document.getElementById("bubble").textContent'),/需要你处理/,'lyrics do not overwrite urgent notifications');
  c.companion.receive({...media,title:'切换后的歌曲',observedAt:Date.now()});
  assert.equal(c.companion.snapshot.media.timelineSource,'unavailable');assert.equal(c.companion.snapshot.media.lyric,null);
  const off=await panelRead('window.pet.musicSettings({musicEnabled:false})');assert.equal(off.ok,true);
  assert.equal(c.companion.snapshot.media.status,'disabled');
  c.updateSettings(previous);
  fs.writeFileSync(path.join(output,'music-report.json'),JSON.stringify({passed:true,checks:['playing humming and notes','unknown native timeline stays indeterminate','real local LRC import and manual calibration IPC','pause freezes manual clock','resume and seek to lyric','renderer previous/toggle/next buttons through IPC with stub controller','largest pet and font with full information below and message above','hover stays open toward controls and hides on exit','generic notification outranks lyric','track changes clear manual calibration and lyrics','disable music setting'],boundary:'Injected media fixture and stub playback commands, without changing live playback; real NetEase metadata checked separately. Its timeline is not provided.'},null,2));
  panel.close();
};
