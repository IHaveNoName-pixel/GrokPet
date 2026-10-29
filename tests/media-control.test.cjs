const {test}=require('node:test');const assert=require('node:assert/strict');
test('media controls reject unknown actions and disabled music before calling the bridge',async()=>{
  const {createMediaController}=require('../desktop/media-control.cjs');let calls=0;
  const control=createMediaController('bridge',async()=>{calls++;return {stdout:'{"ok":true}'};});
  await assert.rejects(control('invalid',true),/无效/);await assert.rejects(control('next',false),/关闭/);assert.equal(calls,0);
});
test('media controls serialize requests, bound execution, and surface player refusal',async()=>{
  const {createMediaController}=require('../desktop/media-control.cjs');let done,options,args;
  const control=createMediaController('bridge',async(_file,a,o)=>{args=a;options=o;return new Promise(resolve=>done=resolve);});
  const request=control('toggle',true);await assert.rejects(control('next',true),/等待/);
  assert.ok(args.includes('--media-command'));assert.ok(args.includes('toggle'));assert.equal(options.timeout,4000);
  done({stdout:'{"ok":false,"reason":"播放器未允许控制"}'});await assert.rejects(request,/播放器未允许/);
});
