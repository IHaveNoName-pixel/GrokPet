'use strict';
const {spawn}=require('node:child_process'),path=require('node:path');
class WindowsVoice{
 constructor({spawnImpl=spawn,timeout=45000}={}){this.spawn=spawnImpl;this.timeout=timeout;this.task=null;}
 cancel(){const task=this.task;this.task=null;task?.stop(Error('语音操作已取消'));}
 run(operation,payload){if(this.task)return Promise.reject(Error('语音操作正在进行'));return new Promise((resolve,reject)=>{const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');let child,output='',done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);if(this.task===task)this.task=null;child?.kill();error?reject(error):resolve(value);};const task={stop:finish},timer=setTimeout(()=>finish(Error('Windows 本地语音超时，可继续文字输入')),this.timeout);this.task=task;
 try{child=this.spawn(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-voice.ps1'),'-Operation',operation],{windowsHide:true,stdio:['pipe','pipe','pipe']});child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;if(output.length>12*1024*1024)finish(Error('本地语音响应过大'));});child.stderr.on('data',()=>{});child.once('error',()=>finish(Error('无法启动 Windows 本地语音服务')));child.stdin.on('error',()=>{});child.once('close',()=>{if(done)return;let result;try{result=JSON.parse(output.replace(/^\uFEFF/,'').trim());}catch{return finish(Error('Windows 本地语音不可用，请检查系统语音组件'));}if(!result.ok)return finish(Error('Windows 本地'+(operation==='transcribe'?'识别':'播报')+'不可用，请在系统设置中检查语音语言包'));finish(null,result);});child.stdin.end(JSON.stringify(payload));}catch{finish(Error('无法启动 Windows 本地语音服务'));}
 });}
 async transcribe(bytes){const r=await this.run('transcribe',{audio:Buffer.from(bytes).toString('base64')});if(!r.text?.trim())throw Error('语音未识别到文字，请重试或键入');return r.text.trim().slice(0,8000);}
 async speak(text){const r=await this.run('speak',{text});const bytes=Buffer.from(r.audio||'','base64');if(!bytes.length||bytes.length>8*1024*1024)throw Error('本地语音返回空音频或音频过大');return bytes;}
}
module.exports={WindowsVoice};
