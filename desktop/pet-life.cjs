'use strict';
const bounded=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(100,v)):fallback;
const clock=(v,fallback)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:fallback;
function normalizePersonality(raw={}){
 const s=raw&&typeof raw==='object'?raw:{};
 return {name:typeof s.name==='string'&&s.name.trim()?s.name.trim().slice(0,24):'软团',activity:['quiet','normal','lively'].includes(s.activity)?s.activity:'normal',scheduleEnabled:s.scheduleEnabled===true,sleepAt:clock(s.sleepAt,'23:00'),wakeAt:clock(s.wakeAt,'08:00')};
}
function normalizeWellbeing(raw={}){const s=raw&&typeof raw==='object'?raw:{};return {energy:bounded(s.energy,80),mood:bounded(s.mood,70),affection:bounded(s.affection,0),updatedAt:Number.isFinite(s.updatedAt)&&s.updatedAt>0?s.updatedAt:0};}
class PetLife{
 constructor(personality={},wellbeing={},now=Date.now()){this.personality=normalizePersonality(personality);this.values=normalizeWellbeing(wellbeing);if(!this.values.updatedAt||this.values.updatedAt>now)this.values.updatedAt=now;this.lastPet=-Infinity;this.advance(now);}
 configure(raw,now=Date.now()){this.advance(now);this.personality=normalizePersonality(raw);}
 isSleeping(now=Date.now()){if(!this.personality.scheduleEnabled)return false;const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));const start=minutes(this.personality.sleepAt),end=minutes(this.personality.wakeAt),d=new Date(now),n=d.getHours()*60+d.getMinutes();return start===end?false:start<end?n>=start&&n<end:n>=start||n<end;}
 advance(now=Date.now()){
  if(now<=this.values.updatedAt)return;
  // Bound offline changes to one day; do not punish a long absence with accumulating debt.
  let at=Math.max(this.values.updatedAt,now-86400000);
  while(at<now){const end=Math.min(now,at+60000),hours=(end-at)/3600000,sleep=this.isSleeping(at)||this.resting===true;
   this.values.energy=bounded(this.values.energy+hours*(sleep?12:this.personality.activity==='lively'?-4:this.personality.activity==='quiet'?-2:-3),80);
   this.values.mood=50+(this.values.mood-50)*Math.exp(-hours/24);at=end;
  }this.values.updatedAt=now;
 }
 pet(now=Date.now()){this.advance(now);if(now-this.lastPet<5000)return false;this.lastPet=now;this.values.mood=bounded(this.values.mood+4,70);this.values.affection=bounded(this.values.affection+.2,0);this.values.energy=bounded(this.values.energy+.5,80);return true;}
 view(now=Date.now()){this.advance(now);return {...this.values};}
 idle(state,now=Date.now()){
  this.advance(now);if(state!=='idle')return state;
  if(this.isSleeping(now))return 'sleeping';
  if(this.values.energy<20)return 'drowsy';
  if(this.values.mood>=80)return this.values.affection>=20?'happy':'playful';
  if(this.values.mood<30)return 'bored';return state;
 }
}
module.exports={PetLife,normalizePersonality,normalizeWellbeing};
