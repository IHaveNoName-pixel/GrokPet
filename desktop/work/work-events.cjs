'use strict';
const path=require('node:path'),{createHash}=require('node:crypto');
const WorkStatus=Object.freeze({IDLE:'idle',RUNNING:'running',WAITING_APPROVAL:'waiting_approval',SUCCEEDED:'succeeded',FAILED:'failed',CANCELLED:'cancelled',UNKNOWN:'unknown'});
const sources=['codex','git','vscode'];
const types={'turn.started':['running'],'tool.started':['running'],'tool.completed':['running','failed'],'approval.requested':['waiting_approval'],'turn.completed':['idle','cancelled','failed','unknown'],'task.verified':['succeeded','failed']};
const clean=(v,max=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
function projectIdentity(cwd){if(typeof cwd!=='string'||cwd.length>1024||/[\u0000-\u001f]/.test(cwd))return 'unassigned';const win=path.win32.isAbsolute(cwd)&&(!cwd.startsWith('/')||cwd.startsWith('//'));if(!win&&!path.posix.isAbsolute(cwd))return 'unassigned';const normalized=(win?path.win32.normalize(cwd).replace(/\\/g,'/').toLowerCase():path.posix.normalize(cwd)).replace(/\/+$/,'');return 'project-'+createHash('sha256').update(normalized).digest('hex').slice(0,20);}
function normalizeWorkEvent(raw,now=Date.now()){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!sources.includes(raw.source)||!types[raw.type]?.includes(raw.status))throw Error('Unsupported work event');
 for(const k of ['id','projectId','sessionId','turnId'])if(typeof raw[k]!=='string'||!raw[k].trim()||raw[k].trim()!==raw[k]||raw[k].length>240||clean(raw[k],240)!==raw[k])throw Error('Invalid work identity');
 if(!Number.isFinite(raw.timestamp)||raw.timestamp<0||raw.timestamp>now+5000)throw Error('Invalid event time');
 if(raw.sequence!==undefined&&(!Number.isSafeInteger(raw.sequence)||raw.sequence<0))throw Error('Invalid sequence');
 const m=raw.metadata||{},metadata={};
 if(raw.source==='codex'&&typeof m.previousTurnId==='string'&&/^local-\d+$/.test(m.previousTurnId))metadata.previousTurnId=m.previousTurnId;
 if(['thinking','searching','writing','working'].includes(m.phase))metadata.phase=m.phase;
 if(typeof m.toolId==='string'&&m.toolId.length<=160)metadata.toolId=clean(m.toolId);
 if(raw.type==='task.verified'){if(m.verification!=='explicit'||typeof m.evidence!=='string'||!m.evidence.trim())throw Error('Explicit verification evidence required');metadata.verification='explicit';metadata.evidence=clean(m.evidence,240);}
 return {id:raw.id,source:raw.source,projectId:raw.projectId,sessionId:raw.sessionId,turnId:raw.turnId,type:raw.type,status:raw.status,timestamp:raw.timestamp,...(raw.sequence!==undefined?{sequence:raw.sequence}:{}),title:clean(raw.title,100),message:clean(raw.message,240),metadata};
}
module.exports={WorkStatus,normalizeWorkEvent,projectIdentity,clean,sources};
