'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
 c.stopTicker();c.updateSettings({workEnabled:true,roam:false});c.companion.focus.action('stop');
 c.companion.start();
 for(let i=0;i<80&&c.companion.work.view().connections.codex?.status!=='online';i++)await wait(100);
 assert.equal(c.companion.work.view().connections.codex.status,'online','existing native hook pipe is available');
 const session='work-stage1-'+process.pid,cwd='C:\\Work Fixture With Spaces';
 async function hook(event,extra={}){
  await new Promise((resolve,reject)=>{const child=spawn(c.companion.bridge,['hook','--event',event,'--channel',c.companion.channel,'--diagnostic'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('Hook relay timeout'));},4000);child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);try{assert.equal(code,0);assert.equal(err,'');assert.deepEqual(JSON.parse(out),{});resolve();}catch(e){reject(e);}});child.stdin.end(JSON.stringify({session_id:session,turn_id:'turn-1',cwd,last_assistant_message:'fixture answer only',...extra}));});await wait(120);
 }
 await hook('UserPromptSubmit');assert.equal(c.companion.activity.state(),'thinking');assert.equal(c.companion.snapshot.work.counts.running,1);const projectId=c.companion.snapshot.work.sessions[0].projectId;assert.match(projectId,/^project-/);assert.doesNotMatch(JSON.stringify(c.companion.snapshot.work),/Fixture With Spaces|fixture answer/,'summary never exposes raw cwd or answer text');
 await hook('PreToolUse',{tool_name:'Bash',tool_use_id:'search',tool_input:{cmd:'rg --files'}});assert.equal(c.companion.activity.state(),'searching');
 await hook('PostToolUse',{tool_use_id:'search',tool_response:{exit_code:0}});
 await hook('PreToolUse',{tool_name:'apply_patch',tool_use_id:'edit'});assert.equal(c.companion.activity.state(),'writing');
 await hook('PermissionRequest');assert.equal(c.companion.activity.state(),'alerting');
 await c.showPanel();await wait(250);const panel=c.getPanel(),ui=s=>panel.webContents.executeJavaScript(s);await ui('document.getElementById("work-section").scrollIntoView({block:"start"})');await wait(100);assert.match(await ui('document.getElementById("work-summary").textContent'),/待处理 1/);
 assert.ok((await c.win.webContents.executeJavaScript('window.pet.workSettings(false)')).error,'only settings window can toggle work center');assert.ok((await ui('window.pet.workSettings("false")')).error,'invalid toggle rejected');
 const save=c.store.save;c.store.save=()=>{throw Error('fixture write failure');};try{assert.match((await ui('window.pet.workSettings(false)')).error,/保存失败/);assert.equal(c.companion.work.enabled,true);}finally{c.store.save=save;}
 await ui('document.getElementById("work-enabled").click()');await wait(200);assert.equal(c.companion.snapshot.work.enabled,false);assert.equal(c.companion.activity.state(),null);assert.equal(c.companion.queue.queue.some(n=>n.id.startsWith('work:')),false);
 await hook('UserPromptSubmit',{turn_id:'disabled-turn'});assert.equal(c.companion.snapshot.work.sessions.length,0);
 await ui('document.getElementById("work-enabled").click()');await wait(200);await hook('UserPromptSubmit',{turn_id:'turn-2'});assert.equal(c.companion.activity.state(),'thinking');
 c.companion.work.disconnect('codex');c.companion.emit();assert.equal(c.companion.snapshot.work.sessions[0].status,'unknown');assert.equal(c.companion.activity.state(),null);c.companion.work.connected('codex');c.companion.emit();assert.equal(c.companion.snapshot.work.sessions[0].status,'unknown','reconnection alone does not revive work');
 await hook('PreToolUse',{turn_id:'turn-2',tool_name:'search',tool_use_id:'resume'});assert.equal(c.companion.activity.state(),'searching');
 await hook('Stop',{turn_id:'turn-2'});assert.equal(c.companion.activity.state(),null);assert.equal(c.companion.snapshot.work.counts.succeeded,0);const count=c.companion.snapshot.work.events.length;await hook('Stop',{turn_id:'turn-2'});assert.equal(c.companion.snapshot.work.events.length,count,'duplicate terminal relay is ignored');
 const verified=c.companion.work.ingest({id:'explicit-test-fixture',source:'codex',projectId,sessionId:'verification-fixture',turnId:'test',type:'task.verified',status:'succeeded',timestamp:Date.now(),metadata:{verification:'explicit',evidence:'Internal smoke fixture only'}});assert.equal(verified.accepted,true);c.companion.emit();assert.equal(c.companion.activity.state(),'proud');await wait(200);assert.match(await ui('document.getElementById("work-sessions").textContent'),/任务验收通过/);
 fs.writeFileSync(path.join(c.root,'artifacts/work-stage1-panel.png'),(await panel.webContents.capturePage()).toPNG());
 const pids=[...c.companion.children].map(p=>p.pid).concat(c.companion.codex.child?.pid||[]);c.companion.stop();const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};for(let i=0;i<25&&pids.some(alive);i++)await wait(100);assert.equal(pids.some(alive),false,'owned native/Codex children exit after stop');assert.equal(c.companion.work.view().enabled,false);
 console.log('Existing Windows hook pipe, project identity, phase mapping, work settings/IPC, neutral Stop, dedupe, reconnect and child cleanup passed; verification success was a labelled internal fixture.');
};
