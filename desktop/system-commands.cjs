 'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
class LaunchStore{
 constructor(file){this.file=file;this.items=[];try{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(data)||data.length>50||data.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string'||!['app','folder'].includes(x.kind)||typeof x.path!=='string'))throw Error('invalid');this.items=data;}catch(e){if(e.code!=='ENOENT')this.error='快捷启动配置损坏，已保留原文件';}}
 save(items){if(this.error)throw Error(this.error);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(items,null,2));fs.renameSync(this.file+'.tmp',this.file);this.items=items;}
 add(name,target,kind){if(typeof name!=='string'||!name.trim()||name.length>40||this.items.length>=50)throw Error('名称需为 1–40 字，最多 50 项');const stat=fs.statSync(target);if(kind==='app'&&(!stat.isFile()||!['.exe','.lnk'].includes(path.extname(target).toLowerCase()))||kind==='folder'&&!stat.isDirectory())throw Error('请选择 EXE、LNK 快捷方式或文件夹');const item={id:randomUUID(),name:name.trim(),path:path.resolve(target),kind};this.save([...this.items,item]);return item;}
 remove(id){if(!this.items.some(x=>x.id===id))throw Error('配置不存在');this.save(this.items.filter(x=>x.id!==id));}
}
function createSystemCommands({store,openApp,openFolder,volume,snapshot}){
 const active=new Set(),recent=new Map();let undo=null,volumeBusy=false;
 return async c=>{
 if(c.type==='system-status'){const s=snapshot(),h=s.hardware||{},n=s.network||{};const p=v=>Number.isFinite(v)?Math.round(v)+'%':'不可用';return {message:'CPU '+p(h.cpu)+' · 内存 '+p(h.memory)+' · GPU '+p(h.gpu)+'；下载 '+(Number.isFinite(n.download)?(n.download/1024).toFixed(1)+' KB/s':'不可用')+'；上传 '+(Number.isFinite(n.upload)?(n.upload/1024).toFixed(1)+' KB/s':'不可用')};}
 if(c.type==='launch'){
 if(store.error)throw Error(store.error);const matches=store.items.filter(x=>c.id?x.id===c.id:x.name.toLocaleLowerCase()===c.name?.trim().toLocaleLowerCase());
 if(!matches.length)throw Error('未配置该目标，请先到设置中添加');
 if(matches.length>1)return {message:'找到多个目标，请输入“打开ID 编号”：'+matches.map(x=>x.name+'（'+x.kind+'） '+x.id).join('；'),candidates:matches.map(({id,name,kind})=>({id,name,kind}))};
 const t=matches[0];if(active.has(t.id)||Date.now()-(recent.get(t.id)||0)<2000)throw Error('刚刚已提交打开请求，请稍候');active.add(t.id);
 try{const stat=await fs.promises.stat(t.path);if(t.kind==='app'){if(!stat.isFile()||!['.exe','.lnk'].includes(path.extname(t.path).toLowerCase()))throw Error('应用路径无效');await openApp(t.path);}else{if(!stat.isDirectory())throw Error('文件夹路径无效');await openFolder(t.path);}recent.set(t.id,Date.now());return {message:'已提交打开请求：'+t.name};}catch(e){throw Error('无法打开 '+t.name+'：'+(e.code==='ENOENT'?'路径已不存在':e.message));}finally{active.delete(t.id);}
 }
 if(c.type==='volume'){
 if(volumeBusy)throw Error('请等待音量操作完成');volumeBusy=true;
 try{const before=await volume();if(c.action==='get')return {message:'主音量 '+before.volume+'%'+(before.muted?'（已静音）':'')};
 let target;if(c.action==='undo'){if(!undo)throw Error('没有可撤销的音量操作');if(before.volume!==undo.after)throw Error('音量已被其他操作改变，取消撤销');target=undo.before;}
 else if(c.action==='set')target=c.value;else if(c.action==='change')target=Math.max(0,Math.min(100,before.volume+c.value));else throw Error('无效音量操作');
 if(!Number.isInteger(target)||target<0||target>100)throw Error('音量需为 0–100');const after=await volume(target);undo=c.action==='undo'?null:{before:before.volume,after:after.volume};return {message:'主音量 '+after.volume+'%'+(after.muted?'（已静音）':'')+(undo?'，可输入“撤销音量”':'')};}finally{volumeBusy=false;}
 }throw Error('未知系统命令');
 };
}
module.exports={LaunchStore,createSystemCommands};
