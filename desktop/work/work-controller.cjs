'use strict';
const {normalizeWorkEvent,sources}=require('./work-events.cjs');const {CodexAdapter}=require('./codex-adapter.cjs');
const scope=e=>JSON.stringify([e.source,e.projectId,e.sessionId]);const turnKey=e=>JSON.stringify([e.source,e.projectId,e.sessionId,e.turnId]);
const labels={codex:'Codex',git:'Git',vscode:'VS Code'};
class WorkController{
 constructor({activity,clock=Date.now,enabled=true,ttl=1800000,maxSessions=100,maxHistory=200,dedupeLimit=1000}={}){if(!activity)throw Error('Existing Activity required');for(const n of [ttl,maxSessions,maxHistory,dedupeLimit])if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid work limits');if(maxSessions>100||maxHistory>1000||dedupeLimit>10000)throw Error('Work limits too large');Object.assign(this,{activity,clock,enabled,ttl,maxSessions,maxHistory,dedupeLimit});this.adapter=new CodexAdapter();this.sessions=new Map();this.seen=new Map();this.closed=new Map();this.completedTools=new Map();this.verified=new Map();this.noticeKeys=new Map();this.events=[];this.connections={};this.stopped=false;}
 remember(map,key,value){map.set(key,value);while(map.size>this.dedupeLimit)map.delete(map.keys().next().value);}
 clearActivity(key){this.activity.tasks.delete(key);this.activity.lastTurns.delete(key);}
 record(e){const {message,metadata,...brief}=e;this.events.push({...brief,phase:metadata?.phase||null});if(this.events.length>this.maxHistory)this.events.splice(0,this.events.length-this.maxHistory);}
 ingest(raw){
  if(!this.enabled||this.stopped)return {accepted:false,reason:'disabled',notices:[]};let e;const now=this.clock();try{e=normalizeWorkEvent(raw,now);}catch{return {accepted:false,reason:'invalid',notices:[]};}
  this.expire(now);const key=scope(e),closed=turnKey(e),dedupe=JSON.stringify([key,e.id]),previous=this.sessions.get(key);
  const reject=reason=>({accepted:false,reason,notices:[]});
  if(now-e.timestamp>this.ttl)return reject('expired');
  if(this.seen.has(dedupe))return reject('duplicate');
  if(e.type==='task.verified'&&this.verified.has(closed))return reject('already-verified');
  if(this.closed.has(closed)&&e.type!=='task.verified')return reject('closed-turn');
  if(previous){if(e.timestamp<previous.timestamp||e.timestamp===previous.timestamp&&e.sequence!==undefined&&previous.sequence!==undefined&&e.sequence<=previous.sequence)return reject('out-of-order');if(e.type!=='turn.started'&&e.turnId!==previous.turnId&&e.metadata.previousTurnId!==previous.turnId)return reject('old-turn');}
  if(previous&&e.type==='turn.started'&&e.turnId!==previous.turnId)this.remember(this.closed,turnKey(previous),previous.timestamp);
  const toolKey=e.metadata.toolId?JSON.stringify([closed,e.metadata.toolId]):null;
  if(toolKey&&['tool.started','tool.completed'].includes(e.type)&&this.completedTools.has(toolKey))return reject('completed-tool');
  if(toolKey&&e.type==='tool.completed')this.remember(this.completedTools,toolKey,e.timestamp);
  if(previous&&e.metadata.previousTurnId===previous.turnId){const task=this.activity.tasks.get(key);if(task)task.turn=e.turnId;}
  this.remember(this.seen,dedupe,e.timestamp);
  const session={source:e.source,projectId:e.projectId,sessionId:e.sessionId,turnId:e.turnId,timestamp:e.timestamp,sequence:e.sequence,status:e.status,type:e.type,phase:e.metadata.phase||null};
  this.sessions.delete(key);this.sessions.set(key,session);while(this.sessions.size>this.maxSessions){const old=this.sessions.keys().next().value;this.clearActivity(old);this.sessions.delete(old);}
  this.record(e);const notices=[];const hook={session:key,turn:e.turnId,toolId:e.metadata.toolId,phase:e.metadata.phase,message:e.message,failed:e.status==='failed'};
  const events={'turn.started':'UserPromptSubmit','tool.started':'PreToolUse','tool.completed':'PostToolUse','approval.requested':'PermissionRequest','turn.completed':e.status==='cancelled'||e.status==='unknown'?'Interrupt':'Stop'};
  if(e.type==='task.verified'){
   this.activity.event({...hook,event:'Stop'},now);this.activity.result(e.status==='failed',now);this.remember(this.verified,closed,e.timestamp);this.remember(this.closed,closed,e.timestamp);notices.push({id:'work:'+dedupe,source:labels[e.source],title:e.status==='succeeded'?'任务验收通过':'任务验收失败',body:e.metadata.evidence,priority:e.status==='failed'?'urgent':'normal'});
  }else{
   const n=e.type==='turn.completed'&&e.status==='unknown'?null:this.activity.event({...hook,event:events[e.type]},now);
   if(n)notices.push({...n,id:'work:'+dedupe,source:labels[e.source]});
   if(e.type==='tool.completed'&&e.status==='failed')notices.push({id:'work:'+dedupe,source:labels[e.source],title:'工具执行失败',body:'请回到原任务查看错误详情。',priority:'urgent'});
   if(e.type==='turn.completed'){this.remember(this.closed,closed,e.timestamp);if(e.status==='failed')this.activity.result(true,now);if(e.status==='unknown')this.clearActivity(key);}
  }
  for(const n of notices)this.remember(this.noticeKeys,n.id,{key,turnId:e.turnId,type:e.type,status:e.status,at:e.timestamp});
  return {accepted:true,event:e,notices};
 }
 noticeCurrent(id){const n=this.noticeKeys.get(id),s=n&&this.sessions.get(n.key);if(!this.enabled||this.stopped||!n||!s||s.turnId!==n.turnId||this.clock()-n.at>this.ttl)return false;return n.type===s.type&&n.status===s.status;}
 receiveCodex(raw){const turns=new Map(this.adapter.turns),counter=this.adapter.counter;let result;try{result=this.ingest(this.adapter.adapt(raw,this.clock()));}catch{result={accepted:false,reason:'invalid',notices:[]};}if(!result.accepted){this.adapter.turns=turns;this.adapter.counter=counter;}return result;}
 expire(now=this.clock()){for(const [key,s]of this.sessions)if(!['turn.completed','task.verified'].includes(s.type)&&['running','waiting_approval','failed'].includes(s.status)&&now-s.timestamp>this.ttl){this.clearActivity(key);s.status='unknown';s.phase=null;s.type='expired';}}
 disconnect(source){if(!sources.includes(source))return;this.connections[source]={status:'offline',at:this.clock()};for(const [key,s]of this.sessions)if(s.source===source&&!['turn.completed','task.verified'].includes(s.type)&&['running','waiting_approval','failed'].includes(s.status)){s.status='unknown';s.phase=null;this.clearActivity(key);}this.activity.celebrateUntil=0;}
 connected(source){if(sources.includes(source)&&this.connections[source]?.status!=='online')this.connections[source]={status:'online',at:this.clock()};}
 setEnabled(value){if(this.enabled===!!value)return;this.enabled=!!value;this.clear();}
 clear(){for(const key of this.sessions.keys())this.clearActivity(key);this.sessions.clear();this.seen.clear();this.closed.clear();this.completedTools.clear();this.verified.clear();this.noticeKeys.clear();this.events=[];this.adapter.clear();this.activity.celebrateUntil=0;}
 view(){this.expire();const sessions=[...this.sessions.values()].map(s=>({...s}));const counts=Object.fromEntries(['idle','running','waiting_approval','succeeded','failed','cancelled','unknown'].map(status=>[status,sessions.filter(s=>s.status===status).length]));return {enabled:this.enabled&&!this.stopped,connections:structuredClone(this.connections),counts,sessions,events:this.events.map(e=>({...e}))};}
 start(){if(this.stopped){this.stopped=false;this.connections={};}}
 stop(){this.stopped=true;this.clear();}
}
module.exports={WorkController};
