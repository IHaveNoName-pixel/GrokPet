'use strict';
const fs=require('node:fs');const path=require('node:path');const {CodexClient}=require('./codex-client.cjs');
class Assistant{
 constructor({client=new CodexClient(),publish=()=>{},fallbackDir}){
  this.client=client;this.publish=publish;this.fallbackDir=fallbackDir;this.generation=0;this.timer=null;this.turnId=null;this.cancelling=false;this.ignoredTurns=new Set();this.requestCounter=0;
  this.snapshot={busy:false,phase:null,messages:[],threadId:null,project:null,error:null};
  client.onNotification=(method,params)=>this.event(method,params);
  client.onDisconnect=()=>{if(this.snapshot.busy)this.fail('Codex 连接已断开，请新建会话后重试');this.snapshot.threadId=null;};
 }
 replaceClient(client){if(this.snapshot.busy)throw new Error('请先停止当前问答');this.reset();this.client=client;client.onNotification=(method,p)=>this.event(method,p);client.onDisconnect=()=>{if(this.snapshot.busy)this.fail('问答连接已断开');this.snapshot.threadId=null;};}
 emit(){this.publish({...this.snapshot,messages:this.snapshot.messages.map(m=>({...m}))});}
 phase(value){this.snapshot.phase=value;this.emit();}
 fail(message){clearTimeout(this.timer);this.snapshot.busy=false;this.snapshot.phase='confused';this.snapshot.error=String(message).slice(0,500);this.emit();}
 async send(text,project=null,owner=null){
  if(typeof text!=='string'||!text.trim()||text.length>8000)throw new Error('请输入1至8000字的问题');
  if(this.snapshot.busy||this.cancelling)throw new Error('请等待当前回复或停止操作完成');
  const cwd=project||this.fallbackDir;
  if(typeof cwd!=='string'||!path.isAbsolute(cwd)||!fs.statSync(cwd).isDirectory())throw new Error('参考项目目录不可用，请重新选择');
  if(this.snapshot.project!==project){this.reset();this.snapshot.project=project;}
  const generation=this.generation;this.snapshot.owner=owner;this.snapshot.requestId=++this.requestCounter;this.snapshot.busy=true;this.snapshot.error=null;this.snapshot.phase='loading';
  this.snapshot.messages.push({role:'user',text:text.trim(),requestId:this.snapshot.requestId});this.snapshot.messages=this.snapshot.messages.slice(-40);this.emit();
  try{
   await this.client.connect();if(generation!==this.generation)return;
   if(!this.snapshot.threadId){
    const read=await this.client.request('config/read',{includeLayers:false});
    const config={'features.apps':false};
    for(const name of Object.keys(read?.config?.mcp_servers||{}))config['mcp_servers.'+name+'.enabled']=false;
    for(const name of Object.keys(read?.config?.plugins||{}))config['plugins.'+name+'.enabled']=false;
    await this.client.configureReadOnly?.(config);if(generation!==this.generation)return;
    const result=await this.client.request('thread/start',{cwd,sandbox:'read-only',approvalPolicy:'never',developerInstructions:'你是桌宠的只读问答助手。只回答问题和阅读参考项目，不修改文件，不执行写入操作，不调用产生外部变更的工具。需要修改时解释只读限制。',config});
    if(generation!==this.generation)return;this.snapshot.threadId=result.thread.id;
    let cursor=null;let pages=0;
    do{
     const inventory=await this.client.request('mcpServerStatus/list',{threadId:this.snapshot.threadId,limit:100,...(cursor?{cursor}:{})});
     if(!Array.isArray(inventory.data)||inventory.data.some(server=>server.runtimeStatus!=='disabled'))throw new Error('只读问答未能关闭外部工具，未发送问题');
     cursor=inventory.nextCursor;if(++pages>20)throw new Error('外部工具检查未完成，未发送问题');
    }while(cursor);
   }
   this.phase('sending');
   const result=await this.client.request('turn/start',{threadId:this.snapshot.threadId,cwd,approvalPolicy:'never',sandboxPolicy:{type:'readOnly',networkAccess:false},input:[{type:'text',text:text.trim()}]});
   if(generation!==this.generation)return;
   if(this.snapshot.busy){this.turnId=result.turn.id;if(this.snapshot.phase==='sending')this.phase('thinking');this.timer=setTimeout(()=>{this.cancel().catch(()=>{});this.fail('回复超时，已停止。可以重新发送。');},180000);}
   return {ok:true};
  }catch(error){if(generation!==this.generation)return {cancelled:true};this.fail(error.message);this.snapshot.threadId=null;this.client.stop();throw error;}
 }
 event(method,p){
  if(!this.snapshot.busy||!this.snapshot.threadId||p.threadId!==this.snapshot.threadId)return;
  const eventTurn=p.turnId||p.turn?.id;
  if(this.ignoredTurns.has(eventTurn)||this.turnId&&eventTurn&&eventTurn!==this.turnId)return;
  if(method==='turn/started')this.turnId=p.turn?.id||this.turnId;
  if(method==='item/agentMessage/delta'){
   let message=this.snapshot.messages.find(m=>m.id===p.itemId&&m.role==='assistant');
   if(!message){message={role:'assistant',id:p.itemId,text:'',requestId:this.snapshot.requestId};this.snapshot.messages.push(message);}
   message.text=(message.text+String(p.delta||'')).slice(0,100000);this.phase('receiving');
  }else if(method==='item/started'){
   const type=p.item?.type;
   if(type==='webSearch')this.phase('searching');else if(type==='commandExecution'||type==='mcpToolCall')this.phase('working');else if(type==='reasoning')this.phase('thinking');
  }else if(method==='item/completed'&&p.item?.type==='agentMessage'){
   let message=this.snapshot.messages.find(m=>m.id===p.item.id&&m.role==='assistant');
   if(!message){message={role:'assistant',id:p.item.id,text:'',requestId:this.snapshot.requestId};this.snapshot.messages.push(message);}
   message.text=String(p.item.text||message.text).slice(0,100000);this.emit();
  }else if(method==='turn/completed'){
   clearTimeout(this.timer);this.turnId=null;this.snapshot.busy=false;
   const failed=p.turn?.status==='failed';this.snapshot.phase=failed?'sad':p.turn?.status==='interrupted'?null:'proud';this.snapshot.error=failed?(p.turn.error?.message||'本次问答失败'):null;this.emit();
  }else if(method==='error'&&p.willRetry!==true)this.fail(p.error?.message||p.message||'Codex 请求失败');
 }
 async cancel(owner=null){
  if(!this.snapshot.busy||this.cancelling||(owner!==null&&this.snapshot.owner!==owner))return;
  const id=this.turnId,threadId=this.snapshot.threadId;this.cancelling=true;this.generation++;clearTimeout(this.timer);this.snapshot.phase='loading';
  if(id){this.ignoredTurns.add(id);if(this.ignoredTurns.size>50)this.ignoredTurns.delete(this.ignoredTurns.values().next().value);}this.emit();
  try{if(id&&threadId)await this.client.request('turn/interrupt',{threadId,turnId:id});else{this.client.stop();this.snapshot.threadId=null;}}
  catch{this.client.stop();this.snapshot.threadId=null;}
  finally{this.cancelling=false;this.snapshot.busy=false;this.snapshot.phase=null;this.turnId=null;this.emit();}
 }
 reset(){this.generation++;clearTimeout(this.timer);this.turnId=null;this.cancelling=false;this.ignoredTurns.clear();this.snapshot={busy:false,phase:null,messages:[],threadId:null,project:null,error:null};this.client.stop();this.emit();}
 stop(){this.reset();}
}
module.exports={Assistant};
