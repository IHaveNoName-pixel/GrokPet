'use strict';
const {spawn}=require('node:child_process');
class TransferProbeMonitor{
 constructor(executable,onResult){this.executable=executable;this.onResult=onResult;this.sources={};this.children=new Map();this.timer=null;this.stopped=true;}
 configure(sources){this.sources={...sources};for(const [key,child] of this.children)if(!this.sources[key]){child.kill();this.children.delete(key);}}
 start(){if(!this.stopped)return;this.stopped=false;this.poll();this.timer=setInterval(()=>this.poll(),5000);}
 poll(){if(this.stopped||!this.executable)return;for(const source of ['thunder','baidu','install'])if(this.sources[source]&&!this.children.has(source))this.run(source);}
 run(source){
  const child=spawn(this.executable,['--transfer-probe',source],{windowsHide:true,stdio:['ignore','pipe','ignore']});this.children.set(source,child);let output='',done=false,timedOut=false;
  child.stdout.on('data',c=>{output+=c;if(output.length>65536)child.kill();});
  const timeout=setTimeout(()=>{timedOut=true;child.kill();},3000);
  const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);if(this.children.get(source)===child)this.children.delete(source);if(this.stopped||!this.sources[source])return;try{const data=ok&&!timedOut?JSON.parse(output.trim()):null;this.onResult(source,data&&data.kind==='transferProbe'?data:null);}catch{this.onResult(source,null);}};
  child.once('error',()=>finish(false));child.once('exit',code=>finish(code===0));
 }
 stop(){this.stopped=true;clearInterval(this.timer);this.timer=null;for(const child of this.children.values())child.kill();this.children.clear();}
}
module.exports={TransferProbeMonitor};
