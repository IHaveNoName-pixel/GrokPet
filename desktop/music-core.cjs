'use strict';
const crypto = require('node:crypto');
function trackKey(track) {
  const text = v => typeof v==='string' ? v.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase() : '';
  const title=text(track?.title);if(!title)return null;
  return crypto.createHash('sha256').update(title+'\n'+text(track.artist)).digest('hex');
}
function parseLrc(raw) {
  if(typeof raw!=='string')return [];
  const offsetMatch=raw.match(/\[offset:([+-]?\d+)\]/i);
  const offset=offsetMatch ? Number(offsetMatch[1]) : 0;
  const result=[];
  for(const line of raw.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const times=[...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if(!times.length)continue;
    const text=line.replace(/\[[^\]]*\]/g,'').replace(/<\d+:\d+(?:\.\d+)?>/g,'').trim().slice(0,500);
    for(const m of times) {
      if(Number(m[2])>=60)continue;
      const at=Number(m[1])*60000+Number(m[2])*1000+Number((m[3]||'').padEnd(3,'0'))+offset;
      if(Number.isFinite(at))result.push({at:Math.max(0,at),text});
    }
  }
  return result.sort((a,b)=>a.at-b.at).slice(0,10000);
}
function lyricAt(lines,position) {
  if(!Array.isArray(lines)||!Number.isFinite(position)||position<0)return null;
  let left=0,right=lines.length-1,index=-1;
  while(left<=right){const mid=(left+right)>>1;if(lines[mid].at<=position){index=mid;left=mid+1;}else right=mid-1;}
  return index<0 ? null : {...lines[index],index};
}
function mediaPosition(media,now=Date.now()) {
  if(media?.status!=='ready'||!Number.isFinite(media.positionMs))return {positionMs:null,durationMs:null,percent:null};
  const duration=Number.isFinite(media.durationMs)&&media.durationMs>0 ? media.durationMs : null;
  let position=Math.max(0,media.positionMs);
  if(media.state==='playing'&&Number.isFinite(media.updatedAt)&&media.updatedAt>0)
    position+=Math.max(0,now-media.updatedAt)*(Number.isFinite(media.rate)&&media.rate>0?media.rate:1);
  if(duration!==null)position=Math.min(position,duration);
  return {positionMs:position,durationMs:duration,percent:duration===null?null:position/duration*100};
}
class MusicClock {
  constructor(){this.raw={status:'none',state:'stopped'};this.manual=null;}
  ingest(raw,now=Date.now()){
    if(trackKey(raw)!==trackKey(this.raw)||raw.status!=='ready')this.manual=null;
    if(this.manual){
      this.manual.positionMs=this.manualPosition(now);this.manual.at=now;
      this.manual.playing=raw.state==='playing';this.manual.rate=Number.isFinite(raw.rate)&&raw.rate>0?raw.rate:1;
    }
    this.raw={...raw};
    if(raw.status==='ready'&&Number.isFinite(raw.positionMs)&&raw.durationMs>0)this.manual=null;
  }
  manualPosition(now){return this.manual.positionMs+(this.manual.playing?Math.max(0,now-this.manual.at)*this.manual.rate:0);}
  calibrate(position,now=Date.now()){
    if(this.raw.status!=='ready'||!trackKey(this.raw))throw new Error('请先在网易云中选中一首歌曲');
    if(!Number.isFinite(position)||position<0||position>86400000)throw new Error('同步时间必须在0至24小时之间');
    this.manual={positionMs:position,at:now,playing:this.raw.state==='playing',rate:1};
  }
  clear(){this.manual=null;}
  view(now=Date.now()){
    const system=mediaPosition(this.raw,now);
    if(system.positionMs!==null)return {...this.raw,...system,trackKey:trackKey(this.raw),timelineSource:'system'};
    if(this.manual)return {...this.raw,positionMs:this.manualPosition(now),durationMs:null,percent:null,trackKey:trackKey(this.raw),timelineSource:'manual'};
    return {...this.raw,...system,trackKey:trackKey(this.raw),timelineSource:'unavailable'};
  }
}
module.exports={trackKey,parseLrc,lyricAt,mediaPosition,MusicClock};
