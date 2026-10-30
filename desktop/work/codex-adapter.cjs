'use strict';
const {createHash}=require('node:crypto');const {projectIdentity}=require('./work-events.cjs');
const mapping={UserPromptSubmit:['turn.started','running'],PreToolUse:['tool.started','running'],PostToolUse:['tool.completed','running'],PermissionRequest:['approval.requested','waiting_approval'],Stop:['turn.completed','idle'],Interrupt:['turn.completed','cancelled']};
class CodexAdapter{
 constructor(){this.turns=new Map();this.counter=0;}
 adapt(raw,now=Date.now()){
  if(!raw||!mapping[raw.event]||typeof raw.session!=='string'||!raw.session||raw.session.length>160)throw Error('Invalid Codex hook');
  for(const key of ['turn','toolId','id'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>160))throw Error('Invalid hook identity');
  const projectId=projectIdentity(raw.cwd),key=JSON.stringify([projectId,raw.session]);let current=this.turns.get(key);
  const previousTurnId=current?.turnId;
  const explicit=typeof raw.turn==='string'&&raw.turn.length>0&&raw.turn.length<=160?raw.turn:null;
  if(raw.event==='UserPromptSubmit')current=raw.id&&current?.promptId===raw.id?current:{turnId:explicit||'local-'+(++this.counter),promptId:raw.id};
  else if(!current)current={turnId:explicit||'local-'+(++this.counter)};
  else if(explicit&&current.turnId.startsWith('local-'))current={turnId:explicit};
  this.turns.delete(key);this.turns.set(key,current);while(this.turns.size>128)this.turns.delete(this.turns.keys().next().value);
  const turnId=explicit||current.turnId,[type,baseStatus]=mapping[raw.event];
  const timestamp=raw.at===undefined?now:raw.at;
  // Semantic IDs ignore relay timestamps; duplicate Stop/tool events cannot replay a notification.
  const id=createHash('sha256').update(JSON.stringify([projectId,raw.session,turnId,raw.event,raw.toolId||'',['PreToolUse','PostToolUse'].includes(raw.event)&&!raw.toolId?(raw.id||timestamp):null])).digest('hex');
  return {id,source:'codex',projectId,sessionId:raw.session,turnId,type,status:raw.event==='PostToolUse'&&raw.failed===true?'failed':baseStatus,timestamp,...(raw.sequence!==undefined?{sequence:raw.sequence}:{}),message:raw.message,metadata:{phase:raw.phase,toolId:raw.toolId,...(previousTurnId?.startsWith('local-')&&explicit?{previousTurnId}:{})}};
 }
 clear(){this.turns.clear();}
}
module.exports={CodexAdapter};
