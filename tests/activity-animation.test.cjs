const {test}=require('node:test');const assert=require('node:assert/strict');
const {Activity,EVENTS}=require('../desktop/companion-core.cjs');const core=require('../desktop/core.js');
test('load animation is only used for idle; every activity and autonomous action wins',()=>{
  for(const base of ['sleeping','waking','curious','playful','bored','happy','dragging'])assert.equal(core.selectAnimation(base,{load:'scared'}),base);
  for(const activity of ['thinking','searching','writing','confused','sad','proud','celebrate','alerting'])assert.equal(core.selectAnimation('idle',{activity,load:'scared'}),activity);
  assert.equal(core.selectAnimation('idle',{music:'humming',load:'scared'}),'humming');
  assert.equal(core.selectAnimation('idle',{load:'scared'}),'scared');
  assert.equal(core.selectAnimation('happy',{interaction:true,activity:'writing',load:'scared'}),'happy');
});
test('prompt, search, edit, tool return and successful completion have distinct phases',()=>{
  const a=new Activity();const e={session:'a',turn:'1'};
  a.event({...e,event:'UserPromptSubmit'},100);assert.equal(a.state(100),'thinking');assert.ok(EVENTS.includes('PreToolUse'));
  a.event({...e,event:'PreToolUse',toolId:'s',phase:'searching'},200);assert.equal(a.state(200),'searching');
  a.event({...e,event:'PostToolUse',toolId:'s'},300);assert.equal(a.state(300),'thinking');
  a.event({...e,event:'PreToolUse',toolId:'w',phase:'writing'},400);assert.equal(a.state(400),'writing');
  a.event({...e,event:'PostToolUse',toolId:'w'},500);a.event({...e,event:'Stop'},600);
  assert.equal(a.state(600),'proud');assert.equal(a.state(2400),'celebrate');assert.equal(a.state(6000),null);
});
test('tool failure is confused, final unresolved failure is sad, later success clears it',()=>{
  const a=new Activity();const e={session:'a',turn:'1'};
  a.event({...e,event:'UserPromptSubmit'},100);a.event({...e,event:'PostToolUse',toolId:'x',failed:true},200);
  assert.equal(a.state(200),'confused');a.event({...e,event:'Stop'},300);assert.equal(a.state(300),'sad');
  a.event({session:'b',turn:'2',event:'UserPromptSubmit'},400);
  a.event({session:'b',turn:'2',event:'PostToolUse',failed:true},500);
  a.event({session:'b',turn:'2',event:'PostToolUse',failed:false},600);
  a.event({session:'b',turn:'2',event:'Stop'},700);assert.equal(a.state(700),'proud');
});
test('parallel tools retain active phase and old-turn events cannot replace the current turn',()=>{
  const a=new Activity();const e={session:'a',turn:'new'};a.event({...e,event:'UserPromptSubmit'},100);
  a.event({...e,event:'PreToolUse',toolId:'w',phase:'writing'},200);
  a.event({...e,event:'PreToolUse',toolId:'s',phase:'searching'},300);
  a.event({...e,event:'PostToolUse',toolId:'s'},400);assert.equal(a.state(400),'writing');
  a.event({...e,event:'PreToolUse',turn:'old',toolId:'x',phase:'searching'},500);assert.equal(a.state(500),'writing');
  a.event({...e,event:'Stop',turn:'old'},600);assert.equal(a.state(600),'writing');
});
test('completed tool IDs reject late starts and repeated failures without reviving activity',()=>{
  const a=new Activity();const e={session:'a',turn:'1'};a.event({...e,event:'UserPromptSubmit'},100);
  a.event({...e,event:'PostToolUse',toolId:'x',failed:false},200);
  a.event({...e,event:'PreToolUse',toolId:'x',phase:'searching'},300);assert.equal(a.state(300),'thinking');
  a.event({...e,event:'PostToolUse',toolId:'x',failed:true},400);assert.equal(a.state(400),'thinking');
});
test('manual preview defers autonomous scheduling for its full duration',()=>{
 const brain=new core.PetBrain(0,()=>0);brain.deferIdle(3500,13000);
 const base=brain.tick(13001);assert.equal(core.selectAnimation(base.state,{interaction:13001<brain.until,activity:'radar'}),'radar');
 assert.equal(brain.tick(16499).state,'idle');
});
