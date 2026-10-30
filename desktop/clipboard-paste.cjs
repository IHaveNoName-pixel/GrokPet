'use strict';
const {execFile}=require('node:child_process');
class ClipboardPaste {
 constructor({target,bridge,owner=process.pid,execute=(file,args)=>new Promise((resolve,reject)=>execFile(file,args,{windowsHide:true,timeout:3000,maxBuffer:8192},(error,out)=>{if(error)return reject(error);try{resolve(JSON.parse(out.trim()));}catch(e){reject(e);}}))}){Object.assign(this,{target,bridge,owner,execute});this.pinned=null;this.busy=false;}
 pin(){const value=this.target();this.pinned=value&&/^\d{1,20}$/.test(value.handle)&&Number.isInteger(value.pid)&&value.pid>0&&value.pid!==this.owner?{...value,pinnedAt:Date.now()}:null;}
 async paste(restore){if(this.busy)return {error:'正在粘贴，请稍候'};this.busy=true;try{try{restore();}catch{return {error:'剪切板项目不存在或无法复制'};}const t=this.pinned,bridge=this.bridge();if(!t||Date.now()-t.pinnedAt>300000||!bridge)return {pasted:false,message:'已复制；请切回目标窗口按 Ctrl+V'};const result=await this.execute(bridge,['--paste-to-window',t.handle,'--target-pid',String(t.pid),'--parent',String(this.owner)]);if(typeof result?.pasted!=='boolean')throw Error('Invalid bridge response');return result;}catch{return {pasted:false,message:'无法自动粘贴；已复制，可手动按 Ctrl+V'};}finally{this.busy=false;}}
}
module.exports={ClipboardPaste};
