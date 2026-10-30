const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeWorkEvent,WorkStatus,projectIdentity}=require('../desktop/work/work-events.cjs');
const {CodexAdapter}=require('../desktop/work/codex-adapter.cjs');
const event=(patch={})=>({id:'e1',source:'codex',projectId:'p1',sessionId:'s1',turnId:'t1',type:'turn.started',status:'running',timestamp:1000,...patch});
test('work event validates sources, types, timestamps and bounded text without arbitrary metadata',()=>{
 const good=normalizeWorkEvent(event({title:'hello\u0000',metadata:{secret:'never'}}),1000);assert.equal(good.title,'hello');assert.equal(good.metadata.secret,undefined);assert.equal(WorkStatus.UNKNOWN,'unknown');
 for(const patch of [{source:'shell'},{type:'made.up'},{timestamp:NaN},{timestamp:100000},{id:''},{sessionId:[]}])assert.throws(()=>normalizeWorkEvent(event(patch),1000));
 assert.throws(()=>normalizeWorkEvent(event({type:'turn.completed',status:'succeeded'}),1000),'turn completion is not verified success');
 assert.throws(()=>normalizeWorkEvent(event({type:'task.verified',status:'succeeded'}),1000),'verification needs explicit evidence');
 assert.equal(normalizeWorkEvent(event({type:'task.verified',status:'succeeded',metadata:{verification:'explicit',evidence:'test suite passed'}}),1000).status,'succeeded');
});
test('project identity normalizes Windows spelling and does not expose paths',()=>{assert.equal(projectIdentity('C:\\Code\\My App'),projectIdentity('c:/code/my app/'));assert.notEqual(projectIdentity('C:\\Code\\A'),projectIdentity('C:\\Code\\B'));assert.equal(projectIdentity('../unknown'),'unassigned');assert.doesNotMatch(projectIdentity('C:\\private\\key'),/private|key/i);});
test('Codex adapter scopes legacy events, infers missing turns, and never interprets answer text as verification',()=>{
 const a=new CodexAdapter();const p=a.adapt({event:'UserPromptSubmit',session:'s',cwd:'C:\\P'},1000);const t=a.adapt({event:'PreToolUse',session:'s',cwd:'C:\\P',toolId:'x',phase:'writing'},1010);assert.equal(t.turnId,p.turnId);assert.equal(t.metadata.phase,'writing');
 const stop=a.adapt({event:'Stop',session:'s',cwd:'C:\\P',message:'全部测试通过，任务完成'},1020);assert.equal(stop.type,'turn.completed');assert.equal(stop.status,'idle');assert.equal(a.adapt({event:'Stop',session:'s',cwd:'C:\\P'},1021).id,stop.id);
 const next=a.adapt({event:'UserPromptSubmit',session:'s',cwd:'C:\\P'},1030);assert.notEqual(next.turnId,p.turnId);assert.equal(a.adapt({event:'Interrupt',session:'s',cwd:'C:\\P'},1040).status,'cancelled');
 assert.throws(()=>a.adapt({event:'Unknown',session:'s'},1000));
});
test('POSIX project paths preserve case while Windows paths remain case insensitive',()=>{assert.notEqual(projectIdentity('/home/Project'),projectIdentity('/home/project'));});
