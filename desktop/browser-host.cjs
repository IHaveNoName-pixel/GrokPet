'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const id='jbnhdhkajoldbipehgdakcblkonojfap',name='com.blobpet.downloads';
function register({dataDir,bridge,run=spawnSync}){
 if(!path.isAbsolute(dataDir)||!path.isAbsolute(bridge)||!fs.existsSync(bridge))throw new Error('桌宠桥接程序不可用');
 const manifest=path.join(dataDir,'browser-native-host.json');const keys=['HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\'+name,'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\'+name];
 const created=[];
 for(const key of keys){const q=run('reg.exe',['query',key,'/ve'],{encoding:'utf8',windowsHide:true});if(q.error)throw q.error;if(q.status!==0&&q.status!==1)throw new Error('无法读取浏览器桥接注册状态');if(q.status===0){const match=q.stdout.match(/REG_\w+\s+([^\r\n]+)/);if(!match||path.resolve(match[1].trim()).toLowerCase()!==path.resolve(manifest).toLowerCase())throw new Error('浏览器桥接名称已被其他程序使用，未覆盖');}else created.push(key);}
 fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(manifest,JSON.stringify({name,description:'BlobPet browser downloads bridge',path:bridge,type:'stdio',allowed_origins:['chrome-extension://'+id+'/']},null,2));
 const done=[];try{for(const key of created){const r=run('reg.exe',['add',key,'/ve','/t','REG_SZ','/d',manifest,'/f'],{encoding:'utf8',windowsHide:true});if(r.error||r.status!==0)throw new Error('无法注册浏览器桥接');done.push(key);}}catch(error){for(const key of done)run('reg.exe',['delete',key,'/f'],{windowsHide:true});throw error;}
 return {manifest,extensionId:id};
}
module.exports={register,id};
