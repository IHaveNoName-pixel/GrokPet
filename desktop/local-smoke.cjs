const assert=require('node:assert/strict');const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
 c.stopTicker();const pet=s=>c.win.webContents.executeJavaScript(s);for(let i=0;i<50&&!await pet('!!bot');i++)await wait(50);
 c.updateSettings({bubbles:true});c.companion.focus.action('stop');c.companion.emit();await wait(100);
 c.getPetAssistant().send=async()=>{throw Error('local commands must not call model')};
 await pet('quickOpen("codex");document.getElementById("quick-input").value="开始专注25分钟";document.getElementById("quick-form").requestSubmit()');await wait(100);assert.equal(c.companion.snapshot.focus.state,'running');assert.ok(await pet('document.getElementById("bubble").textContent.includes("本地指令")'));
 await pet('window.pet.assistantAction({type:"send",mode:"local",text:"结束专注"})');assert.equal(c.companion.snapshot.focus.active,false);
 const result=await pet('window.pet.assistantAction({type:"send",mode:"api",text:"1秒后提醒我本机验收"})');assert.equal(result.local,true);await wait(1150);c.companion.emit();
 const item=c.companion.reminders.items.find(x=>x.title==='本机验收'&&x.status==='due');assert.ok(item);c.companion.emit();assert.equal(c.companion.queue.queue.filter(x=>x.id==='reminder:'+item.id+':'+item.dueAt).length,1);
 await c.showPanel();c.companion.emit();await wait(100);const panel=c.getPanel();assert.ok(await panel.webContents.executeJavaScript('document.getElementById("reminder-list").textContent.includes("本机验收")'));
 assert.equal((await pet('window.pet.reminderAction({type:"snooze",id:'+JSON.stringify(item.id)+'})')).ok,true);assert.equal(c.companion.queue.queue.some(n=>n.id==='reminder:'+item.id+':'+item.dueAt),false);
 assert.equal((await pet('window.pet.reminderAction({type:"complete",id:'+JSON.stringify(item.id)+'})')).ok,true);assert.equal(c.companion.reminders.items.find(x=>x.id===item.id).status,'done');
 const invalid=await pet('window.pet.assistantAction({type:"send",mode:"local",text:"开始专注999分钟"})');assert.ok(invalid.error);
 const {ReminderStore}=require('./local-commands.cjs');assert.equal(new ReminderStore(c.companion.reminders.file).items.find(x=>x.id===item.id).status,'done');
 console.log('Local input routing, zero model calls, reminder due/snooze/completion and saved recovery smoke passed');
};
