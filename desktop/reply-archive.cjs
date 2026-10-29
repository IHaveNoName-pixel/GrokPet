'use strict';
class ReplyArchive{
 constructor(limit=40){this.limit=limit;this.items=new Map();}
 capture(scope,snapshot){if(snapshot.busy||snapshot.error||snapshot.phase!=='proud'||!Number.isSafeInteger(snapshot.requestId))return;const reply=[...snapshot.messages].reverse().find(m=>m.role==='assistant'&&m.requestId===snapshot.requestId&&m.text);if(!reply)return;const key=scope+':'+snapshot.requestId;this.items.set(key,reply.text);while(this.items.size>this.limit)this.items.delete(this.items.keys().next().value);}
 get(scope,id){return Number.isSafeInteger(id)?this.items.get(scope+':'+id)||null:null;}
}
module.exports={ReplyArchive};
