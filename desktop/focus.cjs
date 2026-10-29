'use strict';
const fs=require('node:fs'),path=require('node:path');
class FocusTimer{
 constructor(file=null){this.file=file;this.state='idle';this.duration=0;this.remaining=0;this.deadline=0;this.finished=false;if(file)try{const v=JSON.parse(fs.readFileSync(file,'utf8'));if(['running','paused','idle','complete'].includes(v.state)&&Number.isFinite(v.duration)&&v.duration>=0&&v.duration<=10800000&&Number.isFinite(v.remaining)&&v.remaining>=0&&v.remaining<=v.duration&&Number.isFinite(v.deadline)){Object.assign(this,{state:v.state,duration:v.duration,remaining:v.remaining,deadline:v.deadline});}else throw Error("Invalid focus data");}catch(e){if(e.code!=='ENOENT')this.storageError='专注计时文件损坏，已保留原文件';}}
 save(){if(!this.file)return;if(this.storageError)throw Error(this.storageError);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({state:this.state,duration:this.duration,remaining:this.remaining,deadline:this.deadline}));fs.renameSync(this.file+'.tmp',this.file);}
 consumeCompletion(){if(!this.finished)return false;this.save();this.finished=false;return true;}

 action(type,minutes,now=Date.now()){
  if(this.storageError)throw Error(this.storageError);
  this.view(now);
  if(type==='start'){if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw new Error('时长需为 1–180 分钟');this.duration=this.remaining=minutes*60000;this.deadline=now+this.remaining;this.state='running';this.finished=false;}
  else if(type==='pause'&&this.state==='running'){this.remaining=Math.max(0,this.deadline-now);this.state='paused';}
  else if(type==='resume'&&this.state==='paused'){this.deadline=now+this.remaining;this.state='running';}
  else if(type==='stop'){this.state='idle';this.remaining=0;this.finished=false;}
  else throw new Error('当前无法执行该计时操作');
  const result=this.view(now);this.save();return result;
 }
 view(now=Date.now()){if(this.state==='running'){this.remaining=Math.max(0,this.deadline-now);if(this.remaining===0){this.state='complete';this.finished=true;}}return {state:this.state,active:['running','paused'].includes(this.state),remainingMs:this.remaining,durationMs:this.duration,progress:this.duration?Math.min(100,(1-this.remaining/this.duration)*100):0};}
}
class MetricHistory{
 constructor(){this.samples=[];}
 sample(h,now=Date.now()){this.samples.push({at:now,...Object.fromEntries(['cpu','memory','gpu','download','upload'].map(k=>[k,Number.isFinite(h?.[k])&&h[k]>=0?(['download','upload'].includes(k)?h[k]:Math.min(100,h[k])):null]))});return this.view(now);}
 view(now=Date.now()){this.samples=this.samples.filter(s=>s.at>=now-60000&&s.at<=now).slice(-120);return this.samples;}
}
module.exports={FocusTimer,MetricHistory};
