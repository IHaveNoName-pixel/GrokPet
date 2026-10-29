const {test}=require('node:test');const assert=require('node:assert/strict');
test('ChatGPT uses a fixed official URL, copies only explicit valid text, and never calls Codex',async()=>{
 const {handoffChatGPT}=require('../desktop/web-handoff.cjs');const calls=[];
 await handoffChatGPT(' 私人问题 ',{open:async url=>calls.push(['open',url]),copy:text=>calls.push(['copy',text])});
 assert.deepEqual(calls,[['open','https://chatgpt.com/'],['copy','私人问题']]);
 await assert.rejects(handoffChatGPT(' ',{open:()=>calls.push('bad'),copy:()=>calls.push('bad')}));assert.equal(calls.length,2);
});
test('failed browser opening does not overwrite the clipboard',async()=>{
 const {handoffChatGPT}=require('../desktop/web-handoff.cjs');let copied=false;
 await assert.rejects(handoffChatGPT('问题',{open:async()=>{throw new Error('browser failed');},copy:()=>copied=true}));assert.equal(copied,false);
});
test('concurrent handoffs cannot let an older request overwrite a newer clipboard question',async()=>{
 const {handoffChatGPT}=require('../desktop/web-handoff.cjs');let finish;const copies=[];
 const first=handoffChatGPT('A',{open:()=>new Promise(resolve=>finish=resolve),copy:text=>copies.push(text)});
 try{await assert.rejects(handoffChatGPT('B',{open:async()=>{},copy:text=>copies.push(text)}),/稍候/);}finally{finish();await first;}
 assert.deepEqual(copies,['A']);
});
