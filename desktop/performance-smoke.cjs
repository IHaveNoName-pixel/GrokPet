'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
 c.stopTicker();c.companion.stop();c.updateSettings({roam:false,hudMode:'hidden',dockLayout:'list',bubbles:false,personality:{activity:'normal',scheduleEnabled:false},hudItems:{cpu:true,memory:true,gpu:true,network:true,codex:true,vpn:true},dockItems:{focus:true,load:true,system:true}});
 const ui=s=>c.win.webContents.executeJavaScript(s);await wait(700);
 const fixture={hardware:{cpu:42,memory:68,gpu:19,level:'normal',memoryUsedBytes:8e9,memoryTotalBytes:16e9},quota:{status:'ready',buckets:[{id:'codex',windows:[{minutes:300,remaining:75}]}]},network:{status:'ready',download:20480,upload:3072,tunnels:[],adapters:['fixture']},media:{status:'unavailable'},reminders:{items:[]},focus:{state:'idle',active:false,remainingMs:0,durationMs:0,progress:0},history:Array.from({length:30},(_,i)=>({at:Date.now()-(29-i)*2000,cpu:30+i,memory:68,gpu:19,download:20480,upload:3072}))};
 await ui('stats('+JSON.stringify(fixture)+')');await wait(400);
 await ui(`(()=>{const original=Element.prototype.getBoundingClientRect,queries=Document.prototype.querySelectorAll;let running=false,reads=0,scans=0,records=0,last=0,frames=[],longTasks=[];Element.prototype.getBoundingClientRect=function(...a){if(running)reads++;return original.apply(this,a);};Document.prototype.querySelectorAll=function(...a){if(running)scans++;return queries.apply(this,a);};new MutationObserver(items=>{if(running)records+=items.length;}).observe(document.body,{subtree:true,childList:true,attributes:true});const observer=new PerformanceObserver(list=>{if(running)longTasks.push(...list.getEntries().map(e=>e.duration));});observer.observe({type:'longtask',buffered:false});const frame=t=>{if(running&&last)frames.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);window.perfSample={start(){reads=scans=records=0;last=0;frames=[];longTasks=[];running=true;},end(){running=false;const sorted=frames.slice().sort((a,b)=>a-b);return {layoutReads:reads,documentQueries:scans,mutationRecords:records,frames:frames.length,frameP50:sorted[Math.floor(sorted.length*.5)]||0,frameP95:sorted[Math.floor(sorted.length*.95)]||0,longTasks:longTasks.length,longTaskMs:longTasks.reduce((a,b)=>a+b,0)};}};})()`);
 await ui('window.perfGazeTimer=setInterval(()=>handleGaze({x:0,y:0}),50)');
 const result={label:process.env.BLOBPET_PERF_LABEL||'sample',scenes:{}};
 async function sample(name){await ui('perfSample.start()');for(let i=0;i<4;i++){fixture.hardware.cpu=42+i;await ui('stats('+JSON.stringify(fixture)+')');await wait(1000);}result.scenes[name]=await ui('perfSample.end()');}
 await sample('hidden');c.updateSettings({hudMode:'always'});await wait(700);await sample('cards');
 await c.getRadial().open('system');await wait(900);await sample('systemOrbit');await ui('document.getElementById("close").click()');await wait(800);
 if(process.env.BLOBPET_PERF_ASSERT==='1'){
  await ui('stats('+JSON.stringify(fixture)+')');await wait(100);await ui('window.perfSummaryNode=document.getElementById("system-summary").firstElementChild;window.perfTrendNode=document.querySelector("#system-metrics .metric-trend path")');
  fixture.history.push({...fixture.history.at(-1),at:Date.now(),cpu:43});await ui('stats('+JSON.stringify(fixture)+')');await wait(100);
  assert.equal(await ui('perfSummaryNode===document.getElementById("system-summary").firstElementChild'),true,'history update retains summary DOM');
  assert.equal(await ui('perfTrendNode===document.querySelector("#system-metrics .metric-trend path")'),true,'history update retains chart path');
 }
 await ui('clearInterval(window.perfGazeTimer)');
 fs.mkdirSync(path.join(c.root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(c.root,'artifacts','performance-'+result.label+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
};
