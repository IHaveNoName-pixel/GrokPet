'use strict';
const fs=require('node:fs');const path=require('node:path');
const {trackKey,parseLrc}=require('./music-core.cjs');
class LyricsStore {
  constructor(file){
    this.file=file;this.tracks={};this.corrupt=false;
    try {
      if(fs.statSync(file).size>5*1024*1024)throw new Error('歌词库过大');
      const data=JSON.parse(fs.readFileSync(file,'utf8'));
      for(const [key,value] of Object.entries(data.tracks||{}).slice(-20)){
        if(!/^[a-f0-9]{64}$/.test(key)||!Array.isArray(value?.lines))continue;
        const lines=value.lines.filter(l=>Number.isFinite(l.at)&&l.at>=0&&typeof l.text==='string').slice(0,10000).map(l=>({at:l.at,text:l.text.slice(0,500)})).sort((a,b)=>a.at-b.at);
        if(lines.length)this.tracks[key]={name:typeof value.name==='string'?value.name.slice(0,120):'本地歌词',lines};
      }
    }catch(e){if(e.code!=='ENOENT')this.corrupt=true;}
  }
  forTrack(track){const key=trackKey(track);return key?this.tracks[key]||null:null;}
  import(track,file){
    const key=trackKey(track);if(!key)throw new Error('请先在网易云中选中一首歌曲');
    if(path.extname(file).toLowerCase()!=='.lrc')throw new Error('请选择 LRC 歌词文件');
    if(fs.statSync(file).size>1024*1024)throw new Error('歌词文件不能超过 1 MiB');
    const bytes=fs.readFileSync(file);let text;
    if(bytes[0]===0xff&&bytes[1]===0xfe)text=bytes.subarray(2).toString('utf16le');
    else {try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}}
    const lines=parseLrc(text);if(!lines.some(l=>l.text))throw new Error('文件中没有有效的带时间标签歌词');
    const tracks={...this.tracks,[key]:{name:path.basename(file).slice(0,120),lines}};
    const bounded=Object.fromEntries(Object.entries(tracks).slice(-20));
    const serialized=JSON.stringify({version:1,tracks:bounded});
    if(Buffer.byteLength(serialized,'utf8')>5*1024*1024)throw new Error('解析后的歌词内容过大，请使用更小的歌词文件');
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    if(this.corrupt&&fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.broken');
    fs.writeFileSync(this.file+'.tmp',serialized,'utf8');
    fs.renameSync(this.file+'.tmp',this.file);this.tracks=bounded;this.corrupt=false;
    return bounded[key];
  }
}
module.exports={LyricsStore};
