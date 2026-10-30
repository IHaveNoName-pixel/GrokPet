(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root,api);})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function canReplaceBubble(current,next,busy,now=Date.now()){
  if(['urgent','answer','thinking','feedback'].includes(next))return true;
  if(busy)return false;
  if(now<current.until&&['answer','thinking'].includes(current.type))return false;
  return true;
 }
 class ConversationHistory{
  constructor(limit=20){this.limit=limit;this.items=new Map();}
  ingest(snapshot){if(snapshot?.owner!=='pet')return;for(const m of snapshot.messages||[]){if(!Number.isSafeInteger(m.requestId)||!['user','assistant'].includes(m.role))continue;let row=this.items.get(m.requestId);if(!row){row={id:m.requestId,question:'',answer:'',status:'pending',error:''};this.items.set(m.requestId,row);}if(m.role==='user')row.question=String(m.text||'').slice(0,8000);else if(row.status==='pending'||!row.answer)row.answer=String(m.text||'').slice(0,100000);}
   const row=this.items.get(snapshot.requestId);if(row&&row.status==='pending'&&!snapshot.busy){row.error=String(snapshot.error||'').slice(0,500);row.status=row.error?'failed':snapshot.phase==='proud'&&row.answer?'complete':'cancelled';}
   while(this.items.size>this.limit)this.items.delete(this.items.keys().next().value);
  }
  view(){return [...this.items.values()].map(row=>({...row}));}
 }
 return {ConversationHistory,canReplaceBubble};
});
