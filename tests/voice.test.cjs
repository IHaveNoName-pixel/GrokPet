const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {VoiceStore,VoiceService,speechText}=require('../desktop/voice.cjs');
const codec={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
test('voice config has separate STT/TTS models and secrets; public snapshots never contain keys',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-voice-'));try{const store=new VoiceStore(path.join(dir,'voice.json'),codec);assert.equal(store.public().stt.configured,true);assert.equal(store.public().stt.backend,'windows');
 store.save({stt:{baseUrl:'http://127.0.0.1:8899/v1',model:'recognizer',key:'stt-secret'},tts:{baseUrl:'https://example.com/v1',model:'speaker',voice:'alloy',key:'tts-secret'},autoSpeak:true,shortcut:'Control+Alt+Space'});
 assert.equal(store.current('stt').key,'stt-secret');assert.equal(store.current('tts').key,'tts-secret');assert.ok(!JSON.stringify(store.public()).includes('secret'));assert.equal(store.public().autoSpeak,true);
 assert.throws(()=>store.save({stt:{baseUrl:'http://example.com',model:'bad'}}),/HTTPS/);
 assert.equal(new VoiceStore(store.file,codec).current('tts').model,'speaker');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('speech skips code, links and formatting, and bounds long answers',()=>{const text=speechText('你好 **世界**\n```js\nalert(1)\n```\n[网站](https://example.com)\n'+ '长'.repeat(2000));assert.ok(text.startsWith('你好 世界'));assert.ok(!text.includes('alert'));assert.ok(!text.includes('https'));assert.ok(text.length<=600);});
test('STT uses multipart webm, returns editable text only; TTS returns bounded audio',async()=>{
 const calls=[];const config={baseUrl:'http://localhost:9999/v1',model:'test-model',voice:'alloy',key:'key'};
 const service=new VoiceService({current:()=>config},async(url,options)=>{calls.push({url,options});return url.endsWith('transcriptions')?new Response(JSON.stringify({text:'十分钟后提醒我喝水'}),{headers:{'content-type':'application/json'}}):new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});});
 assert.equal(await service.transcribe(new Uint8Array([1,2,3]),'audio/webm'),'十分钟后提醒我喝水');assert.ok(calls[0].url.endsWith('/v1/audio/transcriptions'));assert.equal(calls[0].options.body.get('file').name,'recording.webm');assert.equal(calls[0].options.body.get('model'),'test-model');
 assert.equal((await service.speak('你好')).length,3);assert.equal(JSON.parse(calls[1].options.body).response_format,'mp3');
});
test('voice cancellation rejects late responses and permits a new operation; empty, HTTP errors and timeout do not become commands',async()=>{
 const config={baseUrl:'https://example.com/v1',model:'test',voice:'alloy'};let finish;
 const service=new VoiceService({current:()=>config},()=>new Promise(r=>finish=r),50);
 const pending=service.transcribe(new Uint8Array([1]),'audio/webm');await assert.rejects(service.transcribe(new Uint8Array([1]),'audio/webm'),/进行/);service.cancel();finish(new Response('{"text":"启动应用"}'));await assert.rejects(pending,/取消/);
 service.fetcher=async()=>new Response('{"text":"  "}');await assert.rejects(service.transcribe(new Uint8Array([1]),'audio/webm'),/未识别/);
 service.fetcher=async()=>new Response('secret and server body',{status:401});await assert.rejects(service.transcribe(new Uint8Array([1]),'audio/webm'),/401/);
 service.fetcher=()=>new Promise(()=>{});await assert.rejects(service.transcribe(new Uint8Array([1]),'audio/webm'),/超时/);
});
test('default Windows speech path uses local adapter and never makes HTTP requests',async()=>{
 const {encodeWav}=require('../pet/voice-controller.js');const samples=new Float32Array([0,.5,-.5,1,-1]);const wav=encodeWav(samples);assert.equal(Buffer.from(wav.subarray(0,4)).toString(),'RIFF');assert.equal(new DataView(wav.buffer).getUint32(24,true),16000);
 let requests=0,cancelled=0;const service=new VoiceService({current:()=>({backend:'windows'})},async()=>{requests++;throw Error('must not call HTTP');});service.local={transcribe:async bytes=>{assert.equal(bytes.length,54);return '提醒我喝水';},speak:async text=>{assert.equal(text,'你好');return wav;},cancel:()=>cancelled++};assert.equal(await service.transcribe(wav,'audio/wav'),'提醒我喝水');assert.equal((await service.speak('**你好**')).length,54);service.cancel();assert.equal(cancelled,1);assert.equal(requests,0);await assert.rejects(service.transcribe(wav,'audio/webm'),/WAV/);
});
