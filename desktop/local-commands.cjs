 'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function parseCommand(input,now=Date.now()){
 if(typeof input!=='string')return null;const text=input.trim().replace(/[。！!]$/,'');let m;
 if(text==='查询系统状态'||text==='系统状态')return {type:'system-status'};
 if(text==='查询音量'||text==='当前音量')return {type:'volume',action:'get'};
 if(text==='撤销音量')return {type:'volume',action:'undo'};
 if((m=text.match(/^音量(?:设为|设置为|调到)\s*(\d{1,3})%?$/)))return {type:'volume',action:'set',value:Number(m[1])};
 if((m=text.match(/^(调高|调低)音量(?:\s*(\d{1,3})%?)?$/)))return {type:'volume',action:'change',value:(m[1]==='调高'?1:-1)*Number(m[2]||5)};
 if((m=text.match(/^打开ID\s+(.{1,80})$/i)))return {type:'launch',id:m[1].trim()};
 if((m=text.match(/^(?:打开|启动)\s*(.{1,80})$/))&&!m[1].startsWith('专注'))return {type:'launch',name:m[1].trim()};
 const invalid=message=>({type:'invalid',message});
 if((m=text.match(/^(?:开始|启动)(?:专注|专注计时)\s*(\d{1,3})\s*分钟$/))){const minutes=Number(m[1]);return minutes>=1&&minutes<=180?{type:'focus-start',minutes}:invalid('专注时长需为 1–180 分钟');}
 const actions={'暂停音乐':'pause','播放音乐':'play','下一首':'next','上一首':'previous','暂停专注':'focus-pause','继续专注':'focus-resume','结束专注':'focus-stop','查看提醒':'reminders','查看待办':'reminders'};if(actions[text])return {type:actions[text]};
 if((m=text.match(/^(显示|隐藏)(系统卡片|音乐卡片|下载卡片|专注卡片|负载卡片|工具栏)$/)))return {type:'dock',key:({'系统卡片':'system','音乐卡片':'music','下载卡片':'transfer','专注卡片':'focus','负载卡片':'load','工具栏':'toolbar'})[m[2]],visible:m[1]==='显示'};
 if((m=text.match(/^(\d{1,5})\s*(秒|分钟|小时)后提醒我(.{1,100})$/))){const delay=Number(m[1])*({秒:1000,分钟:60000,小时:3600000})[m[2]];return delay>0&&delay<=366*86400000?{type:'reminder-create',title:m[3].trim(),dueAt:now+delay}:invalid('提醒时间需大于零且不超过一年');}
 if((m=text.match(/^(今天|明天)(上午|下午|晚上)?\s*(\d{1,2})(?:点|:|：)(?:(\d{1,2})分?)?提醒我(.{1,100})$/))){let hour=Number(m[3]),minute=Number(m[4]||0);if(hour>23||minute>59)return invalid('提醒时间无效');if(['下午','晚上'].includes(m[2])&&hour<12)hour+=12;if(m[2]==='上午'&&hour===12)hour=0;const d=new Date(now);d.setDate(d.getDate()+(m[1]==='明天'?1:0));d.setHours(hour,minute,0,0);return d.getTime()>now?{type:'reminder-create',title:m[5].trim(),dueAt:d.getTime()}:invalid('该时间已经过去，请明确新的时间');}
 if((m=text.match(/^(?:添加待办|记一条待办)[：:\s]*(.{1,100})$/)))return {type:'todo-create',title:m[1].trim()};return null;
}
class ReminderStore{
 constructor(file){this.file=file;this.items=[];this.error=null;try{const raw=fs.readFileSync(file,'utf8');if(raw.length>1000000)throw Error();const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>500||data.some(x=>!x||typeof x.id!=='string'||typeof x.title!=='string'||x.title.length>100||!['pending','due','done'].includes(x.status)||x.dueAt!==null&&!Number.isFinite(x.dueAt)))throw Error();this.items=data;}catch(e){if(e.code!=='ENOENT')this.error='提醒文件损坏或不可读，已保留原文件，未覆盖';}}
 commit(next){if(this.error)throw Error(this.error);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2));fs.renameSync(this.file+'.tmp',this.file);this.items=next;}
 add(title,dueAt,options={}){if(typeof title!=='string'||!title.trim()||title.length>100||dueAt!==null&&!Number.isFinite(dueAt)||this.items.length>=500)throw Error('提醒内容、时间无效或已达到 500 条上限');const item={id:crypto.randomUUID(),title:title.trim(),dueAt,status:'pending',important:options.important===true,repeat: ['daily','weekly'].includes(options.repeat)?options.repeat:null};this.commit([...this.items,item]);return item;}
 acknowledge(id,now=Date.now()){const item=this.items.find(x=>x.id===id);if(!item||item.status!=='due')throw Error('该提醒已更新，请查看当前提醒');this.complete(id,now);}
 complete(id,now=Date.now()){const item=this.items.find(x=>x.id===id);if(!item)throw Error('提醒不存在');let patch={status:'done'};if(item.repeat&&item.dueAt!==null){const d=new Date(item.dueAt),step=item.repeat==='daily'?1:7;do{d.setDate(d.getDate()+step);}while(d.getTime()<=now);patch={status:'pending',dueAt:d.getTime()};}this.commit(this.items.map(x=>x.id===id?{...x,...patch}:x));}
 remove(id){if(!this.items.some(x=>x.id===id))throw Error('提醒不存在');this.commit(this.items.filter(x=>x.id!==id));}
 snooze(id,minutes,now=Date.now()){if(!this.items.some(x=>x.id===id)||!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('提醒或时间无效');this.commit(this.items.map(x=>x.id===id?{...x,status:'pending',dueAt:now+minutes*60000}:x));}
 due(now=Date.now()){return this.items.filter(x=>x.status==='pending'&&x.dueAt!==null&&x.dueAt<=now);}
 markDue(ids){if(ids.length)this.commit(this.items.map(x=>ids.includes(x.id)?{...x,status:'due'}:x));}
}
module.exports={parseCommand,ReminderStore};
