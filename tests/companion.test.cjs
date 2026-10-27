const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quotas, Throughput, Activity, mergeHooks, NoticeQueue, LoadMonitor } = require('../desktop/companion-core.cjs');

test('usage percentages become remaining percentages, unknown stays unknown, multiple buckets survive', () => {
  const got = quotas({ rateLimitsByLimitId: { codex: {primary:{usedPercent:37,windowDurationMins:300,resetsAt:100},secondary:null}, review:{primary:{usedPercent:120,windowDurationMins:10080},secondary:{usedPercent:null}} } });
  assert.equal(got[0].windows[0].remaining, 63);
  assert.equal(got[0].windows.length, 1);
  assert.equal(got[1].windows[0].remaining, 0);
  assert.equal(got[1].windows[1].remaining, null);
  assert.deepEqual(quotas({rateLimits:null}), []);
});
test('throughput uses elapsed time, ignores first samples/resets/new interfaces and virtual double counts', () => {
  const s = new Throughput();
  assert.equal(s.sample([{id:'wifi',rx:1000,tx:500,physical:true},{id:'tun',rx:10000,tx:10000,physical:false}],1000).download, null);
  assert.deepEqual(s.sample([{id:'wifi',rx:5000,tx:2500,physical:true},{id:'tun',rx:90000,tx:90000,physical:false}],3000),{download:2000,upload:1000});
  assert.deepEqual(s.sample([{id:'wifi',rx:5,tx:5,physical:true},{id:'new',rx:99999,tx:99999,physical:true}],5000),{download:null,upload:null});
});
test('task completion cannot clear a different running task and duplicate completions do not replay', () => {
  const a = new Activity();
  a.event({event:'UserPromptSubmit',session:'a',turn:'1'},100);
  a.event({event:'UserPromptSubmit',session:'b',turn:'1'},100);
  assert.equal(a.state(100),'working');
  assert.ok(a.event({event:'Stop',session:'a',turn:'1',message:'完成'},200));
  assert.equal(a.state(200),'working');
  assert.equal(a.event({event:'Stop',session:'a',turn:'1',message:'完成'},201),null);
  a.event({event:'PermissionRequest',session:'b',turn:'1'},300);
  assert.equal(a.state(300),'alerting');
  a.event({event:'Stop',session:'b',turn:'1'},400);
  assert.equal(a.state(400),'celebrate');
  assert.equal(a.state(10000),null);
});
test('hook merge preserves existing handlers and is idempotent without approval decisions', () => {
  const existing = {hooks:{Stop:[{hooks:[{type:'command',command:'existing'}]}]},custom:true};
  const merged = mergeHooks(existing, '"C:\\Pet\\Bridge.exe" hook');
  assert.equal(merged.hooks.Stop[0].hooks[0].command,'existing');
  assert.equal(merged.custom,true);
  assert.deepEqual(mergeHooks(merged, '"C:\\Pet\\Bridge.exe" hook'),merged);
  assert.equal(merged.hooks.PermissionRequest[0].hooks[0].type,'command');
});
test('notifications are bounded, deduplicated, and displayed serially', () => {
  const q = new NoticeQueue();
  assert.equal(q.push({id:'a',source:'test',title:'标题',body:'x'.repeat(999)},0),true);
  assert.equal(q.push({id:'a',source:'test',title:'标题'},1),false);
  assert.ok(q.next(0).body.length <= 240);
  q.push({id:'b',source:'test',title:'第二条'},1);
  assert.equal(q.next(100),null);
  assert.equal(q.next(8001).title,'第二条');
});
test('a late old turn completion cannot clear the new turn and resumed tools clear approval state', () => {
  const a = new Activity();
  a.event({event:'UserPromptSubmit',session:'a',turn:'new'},100);
  a.event({event:'Stop',session:'a',turn:'old'},200);
  assert.equal(a.state(200),'working');
  a.event({event:'PermissionRequest',session:'a',turn:'new'},300);
  a.event({event:'PostToolUse',session:'a',turn:'new'},400);
  assert.equal(a.state(400),'working');
});
test('sustained hardware load animates, short spikes do not, recovery has hysteresis', () => {
  const load = new LoadMonitor();
  assert.equal(load.sample({cpu:95,memory:40,gpu:10},0).animation,null);
  assert.equal(load.sample({cpu:95,memory:40,gpu:10},7999).animation,null);
  assert.equal(load.sample({cpu:95,memory:40,gpu:10},8000).animation,'humming');
  assert.equal(load.sample({cpu:20,memory:40,gpu:10},9000).animation,'humming');
  assert.equal(load.sample({cpu:20,memory:40,gpu:10},24000).animation,null);
  assert.equal(load.sample({cpu:null,memory:null,gpu:null},25000).level,'unknown');
});
test('a GPU bottleneck triggers critical animation after a sustained extreme load', () => {
  const load = new LoadMonitor();
  load.sample({cpu:10,memory:30,gpu:99},100);
  assert.equal(load.sample({cpu:10,memory:30,gpu:99},8100).animation,'scared');
});
test('sessions without turn IDs still complete multiple consecutive turns', () => {
  const a = new Activity();
  a.event({event:'UserPromptSubmit',session:'a'},100);
  assert.ok(a.event({event:'Stop',session:'a'},200));
  a.event({event:'UserPromptSubmit',session:'a'},300);
  assert.ok(a.event({event:'Stop',session:'a'},400));
  assert.equal(a.state(400),'celebrate');
  assert.equal(a.event({event:'Stop',session:'a'},401),null);
});
test('losing the system bridge clears stale hardware values and load animations', () => {
  const { Companion } = require('../desktop/companion.cjs');
  const c = new Companion(__dirname, () => {});
  c.snapshot.hardware = {cpu:99,memory:99,gpu:99,level:'critical',animation:'scared'};
  c.invalidateMetrics('disconnected');
  assert.equal(c.snapshot.hardware.cpu,null);
  assert.equal(c.snapshot.hardware.level,'unknown');
  assert.equal(c.snapshot.hardware.animation,null);
  assert.equal(c.snapshot.network.status,'error');
});
test('a prompt without a turn ID can bind to the subsequent tool and completion turn ID', () => {
  const a = new Activity();
  a.event({event:'UserPromptSubmit',session:'a'},100);
  a.event({event:'PostToolUse',session:'a',turn:'real'},200);
  a.event({event:'Stop',session:'a',turn:'real'},300);
  assert.equal(a.state(300),'celebrate');
});
test('a duplicated old completion cannot bind a new prompt which has no turn ID yet', () => {
  const a = new Activity();
  a.event({event:'UserPromptSubmit',session:'a',turn:'old'},100);
  a.event({event:'Stop',session:'a',turn:'old'},200);
  a.event({event:'UserPromptSubmit',session:'a'},300);
  a.event({event:'Stop',session:'a',turn:'old'},400);
  a.event({event:'PostToolUse',session:'a',turn:'new'},500);
  a.event({event:'Stop',session:'a',turn:'new'},600);
  assert.equal(a.state(600),'celebrate');
});
