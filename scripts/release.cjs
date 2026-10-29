'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist'),target=path.join(dist,'BlobPet-win32-x64');
fs.mkdirSync(dist,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const stage=path.join(dist,'BlobPet-stage-'+stamp),backup=path.join(dist,'BlobPet-backup-'+stamp);
const env={...process.env,BLOBPET_PACKAGE_OUTPUT:stage};
function run(file,args){const result=spawnSync(process.execPath,[path.join(root,file),...args],{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.error||result.status!==0)throw new Error(file+' failed; staged files retained at '+stage);}
run('scripts/package.cjs',[]);run('scripts/smoke.cjs',['--packaged']);
function renameWithRetry(from,to){for(let attempt=0;;attempt++){try{return fs.renameSync(from,to);}catch(error){if(attempt>=10||!['EPERM','EBUSY','EACCES'].includes(error.code))throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);}}}
let movedOld=false,movedData=false;
try{
 if(fs.existsSync(target)){renameWithRetry(target,backup);movedOld=true;}
 const oldData=path.join(backup,'data');if(movedOld&&fs.existsSync(oldData)){renameWithRetry(oldData,path.join(stage,'data'));movedData=true;}
 renameWithRetry(stage,target);
 console.log('Verified release installed at '+target+(movedOld?'; previous release retained at '+backup:''));
}catch(error){
 try{if(movedData&&fs.existsSync(path.join(stage,'data')))renameWithRetry(path.join(stage,'data'),path.join(backup,'data'));if(movedOld&&!fs.existsSync(target))renameWithRetry(backup,target);}catch(rollback){console.error('Rollback failed; inspect '+backup+' and '+stage+': '+rollback.message);}
 throw new Error('Release not switched; close any running desktop pet and retry. '+error.message);
}
