'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function endpoint(base){let u;try{u=new URL(base);}catch{throw new Error('API 地址无效');}if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('使用 HTTPS 地址，本机服务可用 HTTP；地址不要包含密码或查询参数');u.pathname=u.pathname.replace(/\/$/,'');if(!u.pathname.endsWith('/chat/completions'))u.pathname+='/chat/completions';return u.href;}
class ApiStore{
 constructor(file,codec){this.file=file;this.codec=codec;try{this.data=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(this.data.profiles))throw Error();}catch{this.data={profiles:[],active:null,quick:false};}}
 public(){return {active:this.data.active,quick:!!this.data.quick,profiles:this.data.profiles.map(({secret,...p})=>({...p,hasKey:!!secret}))};}
 current(){const p=this.data.profiles.find(p=>p.id===this.data.active);if(!p)throw new Error('请先保存并选择 API 配置');return {...p,key:p.secret?this.codec.decryptString(Buffer.from(p.secret,'base64')):''};}
 save(p){
  if(!p||typeof p.name!=='string'||!p.name.trim()||typeof p.model!=='string'||!p.model.trim()||p.model.length>200)throw new Error('请填写配置名称及模型 ID');endpoint(p.baseUrl);
  const old=this.data.profiles.find(x=>x.id===p.id);let secret=old?.secret||'';
  if(p.clearKey)secret='';else if(typeof p.key==='string'&&p.key.trim()){if(p.key.length>8192||/[\r\n]/.test(p.key))throw new Error('密钥格式无效');if(!this.codec.isEncryptionAvailable())throw new Error('系统加密不可用，未保存密钥');secret=this.codec.encryptString(p.key.trim()).toString('base64');}
  const profile={id:old?.id||crypto.randomUUID(),name:p.name.trim().slice(0,80),baseUrl:p.baseUrl.trim(),model:p.model.trim(),secret};
  const profiles=this.data.profiles.filter(x=>x.id!==profile.id);if(profiles.length>=20)throw new Error('最多保存 20 个配置');profiles.push(profile);this.write({profiles,active:profile.id,quick:p.quick===true});return this.public();
 }
 select(id){if(!this.data.profiles.some(p=>p.id===id))throw new Error('配置不存在');this.write({...this.data,active:id});return this.public();}
 remove(id){const profiles=this.data.profiles.filter(p=>p.id!==id);this.write({...this.data,profiles,active:this.data.active===id?profiles[0]?.id||null:this.data.active,quick:profiles.length?this.data.quick:false});return this.public();}
 write(data){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(data,null,2));fs.renameSync(this.file+'.tmp',this.file);this.data=data;}
}
// Adapt API replies to the existing Assistant lifecycle so owners, cancellation and reply IDs remain shared.
class ApiClient{
 constructor(config,fetcher=fetch){this.config=config;this.fetcher=fetcher;this.threads=new Map();this.task=null;this.controller=null;this.onNotification=()=>{};}
 async connect(){} async configureReadOnly(){}
 async request(method,p={}){
  if(method==='config/read')return {config:{}};if(method==='mcpServerStatus/list')return {data:[]};
  if(method==='thread/start'){const id=crypto.randomUUID();this.threads.set(id,[]);return {thread:{id}};}
  if(method==='turn/interrupt'){this.controller?.abort();await this.task;return {};}
  if(method!=='turn/start')throw new Error('API 模式不支持此操作');
  if(this.controller)throw new Error('请等待当前回复');const turnId=crypto.randomUUID(),messages=this.threads.get(p.threadId);if(!messages)throw new Error('API 会话不存在');
  const text=p.input?.[0]?.text||'';this.controller=new AbortController();const controller=this.controller;
  this.task=this.generate(p.threadId,turnId,messages,text,controller);return {turn:{id:turnId}};
 }
 async generate(threadId,turnId,history,text,controller){
  const emit=(method,p)=>this.onNotification(method,{threadId,turnId,...p});let answer='';const timer=setTimeout(()=>controller.abort('timeout'),120000);
  try{
   const r=await this.fetcher(endpoint(this.config.baseUrl),{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json',...(this.config.key?{Authorization:'Bearer '+this.config.key}:{})},body:JSON.stringify({model:this.config.model,messages:[...history.slice(-20),{role:'user',content:text}],stream:true})});
   if(!r.ok)throw new Error('API 请求失败（HTTP '+r.status+'）'+({401:'，请检查密钥',403:'，无访问权限',429:'，额度不足或请求过于频繁'}[r.status]||''));
   let completed=false,buffer='';const decoder=new TextDecoder();
   const delta=t=>{if(typeof t!=='string')return;answer+=t;if(answer.length>100000)throw new Error('回答超出长度限制');emit('item/agentMessage/delta',{itemId:turnId,delta:t});};
   if((r.headers.get('content-type')||'').includes('application/json')){const raw=await r.text();if(raw.length>1500000)throw new Error('响应过大');const d=JSON.parse(raw);delta(d.choices?.[0]?.message?.content);completed=true;}
   else {if(!r.body)throw new Error('API 未返回内容');streamRead:for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});if(buffer.length>1500000)throw new Error('响应过大');let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]'){completed=true;break streamRead;}const d=JSON.parse(raw);if(d.error)throw new Error('API 服务返回错误');const choice=d.choices?.[0];delta(choice?.delta?.content);if(choice?.finish_reason){if(choice.finish_reason==='length')throw new Error('回答达到服务长度限制，请重新提问');completed=true;}}}if(buffer.trim()==='data: [DONE]')completed=true;}
   if(controller.signal.aborted)throw new Error('aborted');if(!completed)throw new Error('回复连接提前结束，请重试');if(!answer)throw new Error('模型未返回文本，可能不支持此聊天协议');
   history.push({role:'user',content:text},{role:'assistant',content:answer});if(history.length>20)history.splice(0,history.length-20);emit('turn/completed',{turn:{id:turnId,status:'completed'}});
  }catch(error){if(controller.signal.aborted&&controller.signal.reason!=='timeout')emit('turn/completed',{turn:{id:turnId,status:'interrupted'}});else emit('turn/completed',{turn:{id:turnId,status:'failed',error:{message:controller.signal.reason==='timeout'?'API 回复超时':error.message.startsWith('API ')||error.message.startsWith('回复')||error.message.startsWith('模型')||error.message.startsWith('回答')?error.message:'API 连接或响应格式异常，请检查地址和协议'}}});}
  finally{clearTimeout(timer);if(this.controller===controller)this.controller=null;}
 }
 stop(){this.controller?.abort();this.threads.clear();}
}
module.exports={ApiStore,ApiClient,endpoint};
