'use strict';

const {normalizedScene}=require('./scenes.cjs');
const {normalizePersonality,normalizeWellbeing}=require('./pet-life.cjs');
const COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'magenta', 'gray'];
const SHAPES = ['blob', 'pebble', 'squircle', 'tablet', 'wedge', 'hex', 'cloud', 'teardrop'];

function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const coord = v => Number.isFinite(v) && Math.abs(v) < 100000 ? Math.round(v) : null;
  return {
    version: 1,
    vscodeEnabled:s.vscodeEnabled===true,
    dockLayout:s.dockLayout==='carousel'?'carousel':'list',
    workEnabled:typeof s.workEnabled==='boolean'?s.workEnabled:true,
    personality:normalizePersonality(s.personality),
    wellbeing:normalizeWellbeing(s.wellbeing),
    timerScene:normalizedScene(s.timerScene||{id:'focus',name:'专注',kind:'focus',minutes:s.focusMinutes??25,visual:s.focusVisual}),
    customScenes:(Array.isArray(s.customScenes)?s.customScenes:[]).slice(0,12).map(normalizedScene),
    sceneReminderId:typeof s.sceneReminderId==='string'?s.sceneReminderId.slice(0,100):null,
    quickBackend:s.quickBackend==='api'?'api':'codex',
    focusMinutes:Number.isInteger(s.focusMinutes)?Math.max(1,Math.min(180,s.focusMinutes)):25,
    focusVisual:s.focusVisual==='orbit'?'orbit':'progress',
    loadThresholds:Object.fromEntries(['cpu','memory','gpu','seconds'].map(k=>[k,Number.isFinite(s.loadThresholds?.[k])?Math.max(k==='seconds'?2:20,Math.min(k==='seconds'?120:100,Math.round(s.loadThresholds[k]))):({cpu:85,memory:90,gpu:90,seconds:8})[k]])),
    x: coord(s.x), y: coord(s.y),
    size: [96, 128, 160, 192].includes(s.size) ? s.size : 128,
    color: COLORS.includes(s.color) ? s.color : 'black',
    shape: SHAPES.includes(s.shape) ? s.shape : 'blob',
    roam: typeof s.roam === 'boolean' ? s.roam : true,
    alwaysOnTop: typeof s.alwaysOnTop === 'boolean' ? s.alwaysOnTop : true,
    bubbles: typeof s.bubbles === 'boolean' ? s.bubbles : true,
    hudMode: ['hover', 'always', 'hidden'].includes(s.hudMode) ? s.hudMode : 'hover',
    dockItems:Object.fromEntries(['music','transfer','toolbar','system','focus','load','work'].map(k=>[k,s.dockItems?.[k]!==false])),
    hudFontSize: [12, 14, 16].includes(s.hudFontSize) ? s.hudFontSize : 14,
    hudItems: Object.fromEntries(['codex', 'network', 'vpn', 'cpu', 'memory', 'gpu', 'music'].map(key => [key, typeof s.hudItems?.[key] === 'boolean' ? s.hudItems[key] : key!=='music'])),
    summaryItems: Object.fromEntries(['codex','network','vpn','cpu','memory','gpu'].map(key => [key, typeof s.summaryItems?.[key] === 'boolean' ? s.summaryItems[key] : ['cpu','memory','gpu'].includes(key)])),
    summaryOrder: [...new Set([...(Array.isArray(s.summaryOrder)?s.summaryOrder:[]),...'cpu memory gpu codex network vpn'.split(' ')])].filter(k=>['cpu','memory','gpu','codex','network','vpn'].includes(k)),
    summaryMax: Number.isInteger(s.summaryMax)?Math.max(1,Math.min(12,s.summaryMax)):12,
    transferSources:Object.fromEntries(['edge','chrome','thunder','baidu','install'].map(k=>[k,typeof s.transferSources?.[k]==='boolean'?s.transferSources[k]:false])),
    musicEnabled:typeof s.musicEnabled==='boolean'?s.musicEnabled:true,
    musicLyrics:typeof s.musicLyrics==='boolean'?s.musicLyrics:true,
    musicBubbles:typeof s.musicBubbles==='boolean'?s.musicBubbles:true,
    searchEngine:['bing','google','baidu','custom'].includes(s.searchEngine)?s.searchEngine:'bing',
    searchTemplate:typeof s.searchTemplate==='string'?s.searchTemplate.slice(0,2000):'',
  };
}

function clampBounds(bounds, area) {
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))),
    width, height,
  };
}
function clampPetBounds(b,area,size){const half=size/2;return {...b,x:Math.round(Math.max(area.x-180+half,Math.min(b.x,area.x+area.width-180-half))),y:Math.round(Math.max(area.y-216+half,Math.min(b.y,area.y+area.height-216-half)))};}

function placeAssistant(pet,size,area) {
  const right=pet.x+pet.width+10,left=pet.x-size.width-10;
  const x=right+size.width<=area.x+area.width?right:left>=area.x?left:area.x;
  return clampBounds({x,y:pet.y,width:size.width,height:size.height},area);
}

function hitTest(point, bounds, size) {
  return point.x >= bounds.width / 2 - size / 2 && point.x <= bounds.width / 2 + size / 2
    && point.y >= (bounds.petY??216) - size / 2 && point.y <= (bounds.petY??216) + size / 2;
}

function interactiveHit(point,bounds,size,regions=[]){
 return hitTest(point,bounds,size)||regions.some(r=>r&&point.x>=r.x&&point.x<=r.x+r.width&&point.y>=r.y&&point.y<=r.y+r.height);
}

class PetBrain {
  constructor(now = Date.now(), random = Math.random) {
    this.lastInteraction = now;
    this.until = now;
    this.state = 'idle';
    this.dragging = false;
    this.nextIdle = now + 12000;
    this.random = random;
    this.strokes = 0;
  }

  interact(action, now = Date.now()) {
    if (!['pet', 'drag-start', 'drag-end', 'wake'].includes(action)) return;
    if (this.dragging && action !== 'drag-end') return;
    this.lastInteraction = now;
    this.nextIdle = now + 12000;
    if (action === 'drag-start') {
      this.dragging = true;
      this.state = 'dragging';
      return;
    }
    if (action === 'drag-end') {
      this.dragging = false;
      this.state = 'bouncing';
      this.until = now + 1600;
    } else if (this.state === 'sleeping' || this.state === 'drowsy' || action === 'wake') {
      this.state = 'waking';
      this.until = now + 1800;
    } else {
      this.strokes++;
      this.state = this.strokes % 8 === 0 ? 'angry' : this.strokes % 5 === 0 ? 'laughing' : this.strokes % 3 === 0 ? 'shy' : 'happy';
      this.until = now + 2400;
    }
  }

  tick(now = Date.now(), roamEnabled = true) {
    if (this.dragging) return { state: 'dragging', roam: false };
    const idleFor = Math.max(0, now - this.lastInteraction);
    if (now < this.until) return { state: this.state, roam: false };
    if (idleFor >= 90000) this.state = 'sleeping';
    else if (idleFor >= 60000) this.state = 'drowsy';
    else if (now >= this.nextIdle) {
      this.state = ['curious', 'playful', 'bored', 'idle'][Math.floor(this.random() * 4) % 4];
      this.until = now + 3500;
      this.nextIdle = now + 12000 + this.random() * 10000;
    } else this.state = 'idle';
    return { state: this.state, roam: !!roamEnabled && idleFor > 8000 && idleFor < 60000 && this.state === 'idle' };
  }
  deferIdle(duration=3500,now=Date.now()){this.until=0;this.nextIdle=now+duration+1;}
}

function selectAnimation(base,{interaction=false,activity=null,music=null,load=null}={}) {
  if(interaction)return base;
  if(activity)return activity;
  if(music)return music;
  return base==='idle'?(load||base):base;
}
module.exports = { COLORS, SHAPES, normalizeSettings, clampBounds, clampPetBounds, placeAssistant, hitTest, interactiveHit, PetBrain,selectAnimation };
