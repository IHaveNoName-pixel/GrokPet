const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseLrc,lyricAt,trackKey,mediaPosition,MusicClock} = require('../desktop/music-core.cjs');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');

test('LRC supports multiple timestamps, fractions, metadata and offset',()=>{
  const lines=parseLrc('\ufeff[ti:示例]\n[offset:-100]\n[00:01.2][00:03.450]第一句\n[00:02.00]第二句\n[ar:作者]');
  assert.deepEqual(lines,[{at:1100,text:'第一句'},{at:1900,text:'第二句'},{at:3350,text:'第一句'}]);
  assert.equal(lyricAt(lines,1000),null);
  assert.equal(lyricAt(lines,2000).text,'第二句');
  assert.equal(lyricAt(lines,3400).text,'第一句');
  assert.equal(lyricAt(lines,1200).text,'第一句');
});
test('LRC ignores invalid times and preserves blank timed lines to clear lyrics',()=>{
  assert.deepEqual(parseLrc('[00:99.00]坏时间\n[00:01.000]内容\n[00:02.000]'),[{at:1000,text:'内容'},{at:2000,text:''}]);
  assert.equal(lyricAt(parseLrc('[00:01.00]内容\n[00:02.00]'),2100).text,'');
});
test('track identity binds lyrics to song and artist, independent of whitespace/case',()=>{
  assert.equal(trackKey({title:' Song ',artist:' Artist '}),trackKey({title:'song',artist:'artist'}));
  assert.notEqual(trackKey({title:'Song',artist:'A'}),trackKey({title:'Song',artist:'B'}));
  assert.equal(trackKey({title:'',artist:'A'}),null);
});
test('playing timeline advances at its playback rate, paused timeline stays fixed and clamps to duration',()=>{
  const m={status:'ready',state:'playing',positionMs:10000,durationMs:20000,updatedAt:1000,rate:2};
  assert.deepEqual(mediaPosition(m,3000),{positionMs:14000,durationMs:20000,percent:70});
  assert.equal(mediaPosition({...m,state:'paused'},3000).positionMs,10000);
  assert.equal(mediaPosition(m,999999).positionMs,20000);
  assert.equal(mediaPosition({...m,durationMs:0},3000).percent,null);
  assert.equal(mediaPosition({status:'unavailable'},3000).positionMs,null);
});
test('imported lyrics persist only for their bound track and malformed input cannot replace them',t=>{
  const {LyricsStore}=require('../desktop/lyrics-store.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-lyrics-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=new LyricsStore(path.join(dir,'lyrics.json'));
  const file=path.join(dir,'sample.lrc');fs.writeFileSync(file,'[00:01.00]本地示例歌词');
  store.import({title:'A',artist:'B'},file);
  assert.equal(new LyricsStore(path.join(dir,'lyrics.json')).forTrack({title:'A',artist:'B'}).lines[0].text,'本地示例歌词');
  assert.equal(store.forTrack({title:'Another',artist:'B'}),null);
  fs.writeFileSync(file,'没有有效时间轴');
  assert.throws(()=>store.import({title:'A',artist:'B'},file));
  assert.ok(store.forTrack({title:'A',artist:'B'}));
});
test('manual lyric calibration is explicit, follows pause/resume, and clears on track change',()=>{
  const c=new MusicClock();
  const raw={status:'ready',title:'A',artist:'B',state:'playing',positionMs:null,durationMs:0};
  c.ingest(raw,1000);assert.equal(c.view(1000).timelineSource,'unavailable');
  c.calibrate(10000,1000);assert.equal(c.view(3000).positionMs,12000);
  assert.equal(c.view(3000).timelineSource,'manual');assert.equal(c.view(3000).percent,null);
  c.ingest({...raw,state:'paused'},4000);assert.equal(c.view(9000).positionMs,13000);
  c.ingest(raw,10000);assert.equal(c.view(12000).positionMs,15000);
  c.ingest({...raw,title:'Other'},13000);assert.equal(c.view(13000).positionMs,null);
  assert.equal(c.view(13000).timelineSource,'unavailable');
});
test('oversized expanded lyrics cannot replace the existing saved library',t=>{
  const {LyricsStore}=require('../desktop/lyrics-store.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-lyrics-limit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const storeFile=path.join(dir,'lyrics.json'),file=path.join(dir,'sample.lrc');const store=new LyricsStore(storeFile);
  fs.writeFileSync(file,'[00:01.00]保留这句');store.import({title:'original',artist:'A'},file);
  const original=fs.readFileSync(storeFile,'utf8');
  fs.writeFileSync(file,'[00:01.00]'.repeat(10000)+'字'.repeat(500));
  assert.throws(()=>store.import({title:'oversized',artist:'A'},file),/过大|过多/);
  assert.equal(fs.readFileSync(storeFile,'utf8'),original);
  assert.equal(new LyricsStore(storeFile).forTrack({title:'original',artist:'A'}).lines[0].text,'保留这句');
});
test('disabling music or track bubbles discards queued track notices',()=>{
  const {Companion}=require('../desktop/companion.cjs');
  const c=new Companion(__dirname,()=>{});
  c.queue.push({id:'music',source:'网易云音乐',title:'正在播放',body:'Song'});
  c.queue.push({id:'codex',source:'Codex',title:'完成'});
  c.setMusicEnabled(false);assert.equal(c.nextNotice().source,'Codex');
  c.queue.nextAt=0;c.queue.push({id:'music2',source:'网易云音乐',title:'正在播放'});
  c.setMusicBubbles(false);assert.equal(c.nextNotice(),null);
});
