'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
 c.stopTicker();const monitor=c.companion.projects;
 const repo=path.join(c.dataDir,'git UI fixture');fs.mkdirSync(repo,{recursive:true});execFileSync('git',['-C',repo,'init','-q'],{windowsHide:true});
 monitor.store.save({enabled:true,selectedId:null,items:[]});await monitor.store.add(repo,'真实临时仓库');monitor.start();await monitor.changed();c.companion.emit();
 await c.showPanel();const panel=c.getPanel();await wait(400);const ui=js=>panel.webContents.executeJavaScript(js);
 assert.match(await ui('document.getElementById("project-list").textContent'),/真实临时仓库.*干净/s);
 assert.match((await c.win.webContents.executeJavaScript('pet.projects({action:"enabled",value:false})')).error,/设置窗口/);
 assert.match((await ui('pet.projects({action:"select",id:"invented"})')).error,/未登记/);
 fs.writeFileSync(path.join(repo,'new.txt'),'fixture');await ui('document.getElementById("project-refresh").click()');for(let i=0;i<80;i++){await wait(100);if((await ui('document.getElementById("project-list").textContent')).includes('有未提交修改'))break;}
 assert.match(await ui('document.getElementById("project-list").textContent'),/有未提交修改.*未跟踪 1/s);
 await ui('pet.projects({action:"enabled",value:false})');assert.match(await ui('document.getElementById("project-list").textContent'),/监测已停止/);
 await ui('pet.projects({action:"enabled",value:true})');assert.match(await ui('document.getElementById("project-list").textContent'),/有未提交修改/);
 fs.rmSync(repo,{recursive:true,force:true});await ui('pet.projects({action:"refresh"})');assert.match(await ui('document.getElementById("project-list").textContent'),/不可用/);
 await ui('document.getElementById("work-section").scrollIntoView({block:"start"})');await wait(300);
 fs.writeFileSync(path.join(c.root,'artifacts/git-projects-panel.png'),(await panel.webContents.capturePage()).toPNG());
 const id=monitor.store.view().selectedId;await ui(`pet.projects({action:'remove',id:${JSON.stringify(id)}})`);assert.equal(monitor.view().items.length,0);
 monitor.stop();assert.equal(monitor.timer?._destroyed,true);console.log('Git real temporary repository, UI refresh/toggle/remove, unavailable path and IPC ownership passed. Native folder chooser was not automated.');
};
