const {test}=require('node:test');const assert=require('node:assert/strict');
test('HUD availability hides inactive providers while preserving valid zero measurements',()=>{
 const {availableHud}=require('../pet/hud-model.js');
 const value={quota:{status:'error',buckets:[]},network:{status:'ready',download:0,upload:0,tunnels:[],proxyEnabled:false},hardware:{cpu:0,memory:40,gpu:null},media:{status:'none'}};
 assert.deepEqual(availableHud(value,{musicEnabled:true}),{codex:false,network:true,vpn:false,cpu:true,memory:true,gpu:false,music:false});
 value.media={status:'ready',title:'歌',state:'paused'};assert.equal(availableHud(value,{musicEnabled:true}).music,true);assert.equal(availableHud(value,{musicEnabled:false}).music,false);
});
test('browser search validates HTTPS templates and encodes query without opening another mode',()=>{
 const {searchUrl}=require('../desktop/search.cjs');assert.equal(searchUrl('中文 & x','bing'), 'https://www.bing.com/search?q=%E4%B8%AD%E6%96%87%20%26%20x');
 assert.throws(()=>searchUrl('x','custom','javascript:{query}'));assert.throws(()=>searchUrl('x','custom','https://u:p@example.com/?q={query}'));
 assert.throws(()=>searchUrl('x','custom','https://example.com/'));assert.throws(()=>searchUrl(' ','bing'));
});
class FakeClient{
 constructor(){this.calls=[];}
 async connect(){}
 async request(method,params){this.calls.push({method,params});return method==='thread/start'?{thread:{id:'thread'}}:method==='turn/start'?{turn:{id:'turn'}}:method==='mcpServerStatus/list'?{data:[],nextCursor:null}:{};}
 stop(){}
 event(method,params){this.onNotification?.(method,params);}
}
test('assistant fixes read-only policies, streams only its own thread, cancels and resets context',async()=>{
 const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,publish:()=>{},fallbackDir:__dirname});
 await a.send('你好');assert.equal(a.snapshot.busy,true);
 const start=client.calls.find(c=>c.method==='thread/start').params;assert.equal(start.sandbox,'read-only');assert.equal(start.approvalPolicy,'never');
 assert.equal(client.calls.find(c=>c.method==='turn/start').params.sandboxPolicy.type,'readOnly');
 client.event('item/agentMessage/delta',{threadId:'other',turnId:'turn',itemId:'a',delta:'ignore'});assert.ok(!JSON.stringify(a.snapshot).includes('ignore'));
 client.event('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'a',delta:'你好'});assert.equal(a.snapshot.messages.at(-1).text,'你好');
 await a.cancel();assert.ok(client.calls.some(c=>c.method==='turn/interrupt'));
 a.reset();assert.equal(a.snapshot.messages.length,0);assert.equal(a.snapshot.threadId,null);
});
test('readonly assistant refuses to send a model turn if external tools remain available',async()=>{
 const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const request=client.request.bind(client);
 client.request=async(method,params)=>method==='mcpServerStatus/list'?{data:[{tools:{write:{}}}],nextCursor:null}:request(method,params);
 const a=new Assistant({client,publish:()=>{},fallbackDir:__dirname});try{await assert.rejects(a.send('hello'),/外部工具/);assert.ok(!client.calls.some(c=>c.method==='turn/start'));}finally{a.stop();}
});
test('assistant rejects empty/oversized/concurrent requests and clears busy on disconnect',async()=>{
 const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,publish:()=>{},fallbackDir:__dirname});
 await assert.rejects(a.send(' '));await assert.rejects(a.send('x'.repeat(8001)));await a.send('hello');await assert.rejects(a.send('second'));
 client.onDisconnect?.();assert.equal(a.snapshot.busy,false);assert.match(a.snapshot.error,/连接/);
});
test('bidirectional RPC IDs cannot turn a server request into a client response',async()=>{
 const {EventEmitter}=require('node:events');const {CodexClient}=require('../desktop/codex-client.cjs');const writes=[];
 const child={stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:new EventEmitter(),kill:()=>{}};Object.setPrototypeOf(child,new EventEmitter());child.stdin.write=text=>{writes.push(JSON.parse(text));};
 const client=new CodexClient({spawnImpl:()=>child,executable:'fake'});let initialized=false;const connecting=client.connect().then(()=>{initialized=true;});
 child.stdout.emit('data',JSON.stringify({id:1,method:'item/tool/call',params:{}})+'\n');await new Promise(resolve=>setImmediate(resolve));
 try{assert.equal(initialized,false);assert.ok(writes.some(m=>m.id===1&&m.error?.code===-32601));child.stdout.emit('data','{"id":1,"result":{}}\n');await connecting;}finally{client.stop();}
});
test('cancel blocks new requests until acknowledgement and ignores late completed events',async()=>{
 const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,publish:()=>{},fallbackDir:__dirname});
 await a.send('first');let finish;const request=client.request.bind(client);client.request=(method,params)=>method==='turn/interrupt'?new Promise(resolve=>finish=resolve):request(method,params);
 const stopping=a.cancel();await assert.rejects(a.send('too early'));finish({});await stopping;
 // A new turn has a fresh ID; a delayed completion from the cancelled one is ignored.
 client.request=async(method,params)=>method==='turn/start'?{turn:{id:'next-turn'}}:request(method,params);
 await a.send('next');client.event('turn/completed',{threadId:'thread',turn:{id:'turn',status:'interrupted'}});assert.equal(a.snapshot.busy,true);
 client.event('turn/completed',{threadId:'thread',turn:{id:'next-turn',status:'completed'}});assert.equal(a.snapshot.busy,false);a.stop();
});
test('only the owner may stop a running assistant request',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,fallbackDir:__dirname});await a.send('question',null,'pet');assert.equal(a.snapshot.owner,'pet');await a.cancel('window');assert.equal(a.snapshot.busy,true);await a.cancel('pet');assert.equal(a.snapshot.busy,false);a.stop();});
test('reply archive keeps exact completed reply identity across interleaved sessions and resets',()=>{const {ReplyArchive}=require('../desktop/reply-archive.cjs');const a=new ReplyArchive();a.capture('pet',{busy:false,phase:'proud',requestId:1,messages:[{role:'assistant',requestId:1,text:'A'}]});a.capture('window',{busy:false,phase:'proud',requestId:1,messages:[{role:'assistant',requestId:1,text:'B'}]});assert.equal(a.get('pet',1),'A');assert.equal(a.get('window',1),'B');assert.equal(a.get('pet',2),null);});
test('separate assistants maintain concurrent turns and resets do not cross sessions',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const pc=new FakeClient(),wc=new FakeClient(),pet=new Assistant({client:pc,fallbackDir:__dirname}),window=new Assistant({client:wc,fallbackDir:__dirname});try{await Promise.all([pet.send('pet',null,'pet'),window.send('window',null,'window')]);pc.event('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'p',delta:'pet answer'});wc.event('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'w',delta:'window answer'});window.reset();assert.equal(pet.snapshot.busy,true);assert.equal(pet.snapshot.messages.at(-1).text,'pet answer');assert.equal(window.snapshot.messages.length,0);await pet.cancel('pet');}finally{pet.stop();window.stop();}});
test('archive ignores cancelled and failed replies, rejects malformed keys and bounds history',()=>{const {ReplyArchive}=require('../desktop/reply-archive.cjs');const a=new ReplyArchive(1);const snap=(id,text,phase,error=null)=>({busy:false,phase,error,requestId:id,messages:[{role:'assistant',requestId:id,text}]});a.capture('pet',snap(1,'one','proud'));a.capture('pet',snap(2,'failed','sad','error'));assert.equal(a.get('pet',1),'one');a.capture('pet',snap(3,'three','proud'));assert.equal(a.get('pet',1),null);assert.equal(a.get('pet',3),'three');assert.equal(a.get('pet','3'),null);});
test('fatal stream error clears old turn so a retry can receive and complete',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,fallbackDir:__dirname});try{await a.send('first');client.event('error',{threadId:'thread',turnId:'turn',willRetry:false,error:{message:'connection failed'}});assert.equal(a.snapshot.busy,false);const base=client.request.bind(client);client.request=async(m,p)=>m==='turn/start'?{turn:{id:'retry'}}:base(m,p);await a.send('retry');client.event('item/agentMessage/delta',{threadId:'thread',turnId:'retry',itemId:'new',delta:'recovered'});client.event('turn/completed',{threadId:'thread',turn:{id:'retry',status:'completed'}});assert.equal(a.snapshot.busy,false);assert.equal(a.snapshot.messages.at(-1).text,'recovered');}finally{a.stop();}});
test('connection failure preserves draft in caller and retry succeeds',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();let attempts=0;client.connect=async()=>{if(++attempts===1)throw new Error('连接失败');};const a=new Assistant({client,fallbackDir:__dirname});try{await assert.rejects(a.send('first'),/连接失败/);assert.equal(a.snapshot.busy,false);assert.match(a.snapshot.error,/连接失败/);await a.send('retry');client.event('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'retry',delta:'成功'});client.event('turn/completed',{threadId:'thread',turn:{id:'turn',status:'completed'}});assert.equal(a.snapshot.busy,false);assert.equal(a.snapshot.messages.at(-1).text,'成功');assert.equal(a.snapshot.error,null);}finally{a.stop();}});
test('failed generation reports error and next turn can finish',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient();const a=new Assistant({client,fallbackDir:__dirname});try{await a.send('first');client.event('turn/completed',{threadId:'thread',turn:{id:'turn',status:'failed',error:{message:'生成失败'}}});assert.equal(a.snapshot.error,'生成失败');assert.equal(a.snapshot.busy,false);const base=client.request.bind(client);client.request=async(m,p)=>m==='turn/start'?{turn:{id:'retry-2'}}:base(m,p);await a.send('retry');client.event('turn/completed',{threadId:'thread',turn:{id:'retry-2',status:'completed'}});assert.equal(a.snapshot.busy,false);assert.equal(a.snapshot.error,null);}finally{a.stop();}});
test('long streamed response is bounded and remains accessible after completion',async()=>{const {Assistant}=require('../desktop/assistant.cjs');const client=new FakeClient(),a=new Assistant({client,fallbackDir:__dirname});try{await a.send('long');client.event('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'long',delta:'长'.repeat(110000)});client.event('turn/completed',{threadId:'thread',turn:{id:'turn',status:'completed'}});assert.equal(a.snapshot.messages.at(-1).text.length,100000);assert.equal(a.snapshot.busy,false);}finally{a.stop();}});
