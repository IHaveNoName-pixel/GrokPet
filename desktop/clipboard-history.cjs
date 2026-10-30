'use strict';
const {createHash,randomUUID}=require('node:crypto');
class ClipboardHistory{
 constructor(read,publish,{limit=30,maxBytes=16*1024*1024}={}){Object.assign(this,{read,publish,limit,maxBytes});this.enabled=false;this.items=[];this.last='';this.error='';this.revision=0;}
 enable(value){if(typeof value!=='boolean')throw Error('无效剪切板开关');this.enabled=value;clearInterval(this.timer);if(value){this.poll();this.timer=setInterval(()=>this.poll(),700);this.timer.unref?.();}else this.error='';this.notify();}
 notify(){this.revision++;this.publish({enabled:this.enabled,revision:this.revision});}
 poll(){if(!this.enabled)return;try{const v=this.read();if(!v||!['text','image'].includes(v.kind))return;const bytes=v.kind==='text'?Buffer.from(v.text||''):v.bytes;if(!bytes?.length||bytes.length>Math.min(this.maxBytes,4*1024*1024)||v.kind==='text'&&(v.text.length>20000)||v.kind==='image'&&(!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width*v.height>16777216))return;const signature=createHash('sha256').update(v.kind).update(bytes).digest('hex');if(signature===this.last){if(this.error){this.error='';this.notify();}return;}this.last=signature;this.items=this.items.filter(i=>i.signature!==signature);this.items.unshift({id:randomUUID(),kind:v.kind,at:Date.now(),signature,size:bytes.length,...(v.kind==='text'?{text:v.text}:{bytes:Buffer.from(bytes),width:v.width,height:v.height})});while(this.items.length>this.limit||this.items.reduce((n,i)=>n+i.size,0)>this.maxBytes)this.items.pop();this.error='';this.notify();}catch{if(!this.error){this.error='剪切板暂时不可用';this.notify();}}}
 get(id){const item=this.items.find(i=>i.id===id);if(!item)throw Error('剪切板记录已不可用');return item;}
 restored(id){this.last=this.get(id).signature;}
 remove(id){this.get(id);this.items=this.items.filter(i=>i.id!==id);this.notify();}
 clear(){this.items=[];this.notify();}
 view(){return {enabled:this.enabled,revision:this.revision,error:this.error,items:this.items.map(({bytes,signature,...i})=>({...i,...(bytes?{dataUrl:'data:image/png;base64,'+bytes.toString('base64')}:{})}))};}
 stop(){clearInterval(this.timer);this.enabled=false;this.items=[];}
}
module.exports={ClipboardHistory};
