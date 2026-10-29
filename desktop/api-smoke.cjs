const assert=require('node:assert/strict'),http=require('node:http');const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async c=>{
 c.stopTicker();const calls=[];const server=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{calls.push(JSON.parse(body));assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer fixture-test-key');res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: '+JSON.stringify({choices:[{delta:{content:'API 模拟回复🙂'},finish_reason:null}]})+'\n\n');res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  await c.showAssistant();const w=c.getAssistantWindow(),read=s=>w.webContents.executeJavaScript(s),pet=s=>c.win.webContents.executeJavaScript(s);const base='http://127.0.0.1:'+server.address().port+'/v1';
  await read('document.getElementById("api-settings").open=true;document.getElementById("api-name").value="本机验收模型";document.getElementById("api-base").value='+JSON.stringify(base)+';document.getElementById("api-model").value="fixture-one";document.getElementById("api-key").value="fixture-test-key";document.getElementById("api-quick").checked=true;document.getElementById("api-save").click()');await wait(150);
  assert.equal(calls.length,0,'saving configuration never sends a billable request');assert.equal(await read('document.getElementById("api-key").value'),'');assert.equal((await pet('window.pet.ready()')).quickBackend,'api');
  await read('document.getElementById("mode").value="api";document.getElementById("mode").dispatchEvent(new Event("change"));document.getElementById("question").value="窗口模拟问答";document.getElementById("composer").requestSubmit()');
  for(let i=0;i<80&&(calls.length<1||c.getAssistant().snapshot.busy);i++)await wait(50);assert.equal(c.getAssistant().snapshot.phase,'proud');assert.equal(calls[0].model,'fixture-one');assert.equal(c.getAssistant().snapshot.provider,'API 模型');assert.ok(await read('document.getElementById("messages").textContent.includes("API 模拟回复")'));
  await pet('quickOpen("api");document.getElementById("quick-input").value="气泡模拟问答";document.getElementById("quick-form").requestSubmit()');
  for(let i=0;i<80&&(calls.length<2||c.getPetAssistant().snapshot.busy);i++)await wait(50);assert.equal(c.getPetAssistant().snapshot.phase,'proud');assert.equal(calls[1].messages.length,1,'pet does not receive the window conversation');assert.ok(await pet('document.getElementById("bubble").textContent.includes("API 模拟回复")'));
  const id=c.getPetAssistant().snapshot.requestId;const r=await pet('window.pet.assistantAction({type:"repeat-answer",requestId:'+id+'})');assert.equal(r.text,'API 模拟回复🙂');
  assert.ok(!JSON.stringify(await read('window.pet.assistantInfo()')).includes('fixture-test-key'));
  console.log('API settings, encrypted-key boundary, independent streamed window and bubble replies smoke passed');
 }finally{c.getAssistant()?.stop();c.getPetAssistant()?.stop();server.closeAllConnections();await new Promise(r=>server.close(r));}
};
