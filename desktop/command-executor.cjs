 'use strict';
const {parseCommand}=require('./local-commands.cjs');
const {randomUUID}=require('node:crypto');
const dockKeys=['music','transfer','toolbar','system','focus','load'];
function createCommandExecutor(deps){
 let musicBusy=false;
 return async function execute(input,meta={}){
  const command=typeof input==='string'?parseCommand(input):input;if(!command)return null;
  if(typeof command!=='object'||typeof command.type!=='string')throw Error('无效命令');
  if(meta.signal?.aborted)throw Error('命令已取消');
  const type=command.type;let data;
  if(['launch','volume','system-status'].includes(type)){const result=await deps.system(command);return {ok:true,local:true,commandId:type,requestId:randomUUID(),source:meta.source||'local',...result};}
  if(type==='invalid')throw Error(command.message);
  if(type==='focus-start'){if(!Number.isInteger(command.minutes)||command.minutes<1||command.minutes>180)throw Error('时长需为 1–180 分钟');if(deps.focus.view().active)throw Error('请先结束当前专注');deps.focus.action('start',command.minutes);}
  else if(['focus-pause','focus-resume','focus-stop'].includes(type))deps.focus.action(type.slice(6));
  else if(type==='dock'){if(!dockKeys.includes(command.key)||typeof command.visible!=='boolean')throw Error('无效卡片设置');deps.setDock(command.key,command.visible);}
  else if(type==='display-settings'){if(!command.patch||typeof command.patch!=='object'||Array.isArray(command.patch))throw Error('非法显示设置');deps.setDisplay(command.patch);}
  else if(type==='reminder-create'||type==='todo-create'){const dueAt=type==='todo-create'?null:command.dueAt;if(dueAt!==null&&(!Number.isFinite(dueAt)||dueAt<=Date.now()))throw Error('请选择未来时间');data=deps.reminders.add(command.title,dueAt,command.options||{});}
  else if(type==='reminder-action'){if(!['acknowledge','complete','snooze','remove'].includes(command.action)||typeof command.id!=='string'||!command.id)throw Error('无效提醒操作');data=command.action==='snooze'?deps.reminders.snooze(command.id,5):deps.reminders[command.action](command.id);}
  else if(type==='reminders')await deps.showPanel();
  else if(['pause','play','next','previous','toggle'].includes(type)){
   if(musicBusy)throw Error('请等待上一次音乐操作完成');musicBusy=true;
   try{if(['pause','play'].includes(type)){const state=deps.mediaState();if(!['playing','paused'].includes(state))throw Error('尚未确认播放器状态，请在音乐卡片操作');if(type==='pause'&&state==='playing'||type==='play'&&state==='paused')await deps.musicControl('toggle');}else await deps.musicControl(type);}finally{musicBusy=false;}
  }else throw Error('未知本地命令');
  deps.emit();const prefix={'reminder-create':'已保存提醒：','todo-create':'已添加待办：'}[type];return {ok:true,local:true,commandId:type,requestId:randomUUID(),source:meta.source||'local',data,message:prefix?prefix+command.title:'本地指令已执行'};
 };
}
module.exports={createCommandExecutor};
