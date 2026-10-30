'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const {projectIdentity,clean}=require('./work-events.cjs');
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function gitRead(root,args,{signal,timeout=4000,maxBuffer=262144,git='git'}={}){
 const env={...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'};
 for(const k of Object.keys(env))if(/^GIT_/i.test(k)&&!['GIT_OPTIONAL_LOCKS','GIT_TERMINAL_PROMPT'].includes(k))delete env[k];
 return new Promise((resolve,reject)=>execFile(git,['--no-optional-locks','--no-pager','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',root,...args],{windowsHide:true,encoding:'utf8',timeout,maxBuffer,signal,env},(error,stdout)=>error?reject(error):resolve(stdout)));
}
async function canonicalRoot(root,options){
 if(typeof root!=='string'||root.length>1024||!path.isAbsolute(root)||/[\x00-\x1f]/.test(root))throw Error('请选择有效的本机 Git 项目目录');
 const real=await fs.promises.realpath(root);if(!(await fs.promises.stat(real)).isDirectory())throw Error('项目路径不是目录');
 let top;try{top=(await gitRead(real,['rev-parse','--show-toplevel'],options)).trim();}catch{throw Error('目录不是可读取的 Git 工作仓库，或 Git 未安装');}
 if(!samePath(real,await fs.promises.realpath(top)))throw Error('请选择 Git 仓库根目录');return real;
}
function parseStatus(output){
 const records=output.split('\0'),header=records.shift();if(!header?.startsWith('## '))throw Error('Git 状态格式无效');
 const counts={changed:0,untracked:0,conflicts:0};
 for(let i=0;i<records.length;i++){const row=records[i];if(!row)continue;if(row.length<4||row[2]!==' ')throw Error('Git 状态格式不完整');const xy=row.slice(0,2);if(xy==='??')counts.untracked++;else if(['DD','AU','UD','UA','DU','AA','UU'].includes(xy))counts.conflicts++;else counts.changed++;if(/[RC]/.test(xy)){if(!records[++i])throw Error('Git 重命名记录不完整');}}
 const branch=clean(header.slice(3).replace(/^(No commits yet on |Initial commit on )/,'').split('...')[0],120);
 return {status:counts.conflicts?'conflict':counts.changed||counts.untracked?'dirty':'clean',counts,branch};
}
async function inspectRepository(root,options={}){
 const supplied=options instanceof AbortSignal?{signal:options}:options;
 const deadline=AbortSignal.timeout(supplied.timeout||4000),opts={...supplied,signal:supplied.signal?AbortSignal.any([supplied.signal,deadline]):deadline};
 try{
  const real=await canonicalRoot(root,opts);if(!samePath(real,root))throw Error('项目实际路径已变化，请重新登记');
  const statusOutput=await gitRead(real,['status','--porcelain=v1','-z','--branch','--untracked-files=normal'],opts),status=parseStatus(statusOutput);
  // An unborn HEAD is a valid empty repository. Other log failures must not become clean.
  let commit=null;const hasHead=await gitRead(real,['rev-parse','--verify','--quiet','HEAD'],opts).then(()=>true,e=>{if(e.code===1&&/## (No commits yet on |Initial commit on )/.test(statusOutput))return false;throw e;});
  if(hasHead){const parts=(await gitRead(real,['log','-1','--format=%h%x00%s','--no-show-signature'],opts)).split('\0');commit={hash:clean(parts[0],40),title:clean(parts[1]?.trim(),160)};}
  return {...status,commit,checkedAt:Date.now(),error:''};
 }catch(error){return {status:'unavailable',checkedAt:Date.now(),error:deadline.aborted?'Git 检查超时':error.name==='AbortError'?'检查已停止':error.killed?'Git 检查超时':error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'Git 状态过大，已停止读取':error.code==='ENOENT'?'目录已移除或 Git 不可用':clean(error.message,180)};}
}
class ProjectStore{
 constructor(file){this.file=file;this.data={enabled:true,selectedId:null,items:[]};this.error='';try{const value=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof value.enabled!=='boolean'||!Array.isArray(value.items)||value.items.length>12)throw Error('项目登记格式无效');const ids=new Set();for(const item of value.items){if(!item||!path.isAbsolute(item.path||'')||item.path.length>1024||item.id!==projectIdentity(item.path)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||ids.has(item.id))throw Error('项目登记项无效');ids.add(item.id);}this.data={enabled:value.enabled,items:value.items.map(({id,name,path})=>({id,name,path})),selectedId:ids.has(value.selectedId)?value.selectedId:value.items[0]?.id||null};}catch(e){if(e.code!=='ENOENT'){fs.copyFileSync(file,file+'.broken');this.error='项目登记已损坏，原文件已备份，请重新登记';}}}
 view(){return structuredClone(this.data);}
 save(next){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2)+'\n');fs.renameSync(this.file+'.tmp',this.file);this.data=next;this.error='';}
 async add(root,name){if(name!==undefined&&(typeof name!=='string'||!name.trim()||name.length>80||clean(name,80)!==name))throw Error('项目名称需为 1–80 个字符');const real=await canonicalRoot(root),id=projectIdentity(real);const old=this.data.items.find(x=>x.id===id);if(old){this.select(id);return old;}if(this.data.items.length>=12)throw Error('最多登记 12 个项目');const item={id,path:real,name:name||path.basename(real)||'Git 项目'};this.save({...this.data,selectedId:id,items:[...this.data.items,item]});return item;}
 select(id){if(!this.data.items.some(x=>x.id===id))throw Error('项目未登记');this.save({...this.data,selectedId:id});}
 remove(id){if(!this.data.items.some(x=>x.id===id))throw Error('项目未登记');const items=this.data.items.filter(x=>x.id!==id);this.save({...this.data,items,selectedId:this.data.selectedId===id?items[0]?.id||null:this.data.selectedId});}
 setEnabled(enabled){if(typeof enabled!=='boolean')throw Error('无效的监测设置');this.save({...this.data,enabled});}
}
class GitMonitor{
 constructor(store,publish,options={}){this.store=store;this.publish=publish;this.inspect=options.inspect||inspectRepository;this.results=new Map();this.active=false;this.generation=0;this.pending=null;this.controller=null;}
 view(){const d=this.store.view();return {...d,error:this.store.error,refreshing:!!this.pending,items:d.items.map(x=>({...x,...(d.enabled&&this.active?this.results.get(x.id)||{status:'unknown'}:{status:'disabled'})}))};}
 start(){if(this.active)return;this.active=true;this.timer=setInterval(()=>this.refresh(),15000);this.timer.unref?.();this.refresh();}
 stop(){this.active=false;clearInterval(this.timer);this.generation++;this.controller?.abort();this.results.clear();}
 changed(){this.generation++;this.controller?.abort();this.results.clear();const prior=this.pending;return (prior||Promise.resolve()).then(()=>this.refresh());}
 setEnabled(value){this.store.setEnabled(value);return this.changed();}
 refresh(){if(this.pending)return this.pending;if(!this.active||!this.store.data.enabled)return Promise.resolve();const generation=this.generation,controller=this.controller=new AbortController();const items=this.store.view().items;
  this.pending=(async()=>{for(const item of items){if(controller.signal.aborted)break;const result=await this.inspect(item.path,controller.signal);if(!this.active||generation!==this.generation||controller.signal.aborted)break;if(this.store.data.items.some(x=>x.id===item.id))this.results.set(item.id,result);}})().catch(()=>{}).finally(()=>{this.pending=null;this.publish();});return this.pending;}
}
module.exports={ProjectStore,GitMonitor,inspectRepository,parseStatus,gitRead};
