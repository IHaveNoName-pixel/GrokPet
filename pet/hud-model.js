(function(g){
 function availableHud(s,settings={}){
  const n=s?.network||{},h=s?.hardware||{},m=s?.media||{},q=s?.quota||{};const finite=Number.isFinite;
  return {codex:q.status==='ready'&&(q.buckets||[]).some(b=>(b.windows||[]).some(w=>finite(w.remaining))),network:n.status==='ready'&&(finite(n.download)||finite(n.upload)),vpn:n.status==='ready'&&!!(n.tunnels?.length||n.proxyEnabled||n.pacConfigured),cpu:finite(h.cpu),memory:finite(h.memory),gpu:finite(h.gpu),music:settings.musicEnabled!==false&&m.status==='ready'&&typeof m.title==='string'&&!!m.title.trim()};
 }
 function systemMetrics(s={},settings={}){
  const selected=settings.hudItems||{cpu:true,memory:true,gpu:true,codex:true,network:true,vpn:true};
  const available=availableHud(s,settings),h=s.hardware||{},out=[];
  const clamp=n=>Math.max(0,Math.min(100,n));
  const bytes=n=>Number.isFinite(n)?(n/1024**3).toFixed(1)+' GB':'—';
  const speed=n=>Number.isFinite(n)?(n>=1024**2?(n/1024**2).toFixed(1)+' MB/s':(n/1024).toFixed(1)+' KB/s'):'—';
  for(const key of ['cpu','memory','gpu'])if(selected[key]&&available[key])out.push({key,label:{cpu:'CPU',memory:'内存',gpu:'GPU'}[key],value:clamp(h[key]),detail:key==='memory'&&h.memoryTotalBytes?'已用 '+bytes(h.memoryUsedBytes)+' / '+bytes(h.memoryTotalBytes):key==='gpu'?'最忙引擎'+(Number.isFinite(h.gpuDedicatedBytes)?' · 显存 '+bytes(h.gpuDedicatedBytes):''):'处理器负载'});
  if(selected.codex&&available.codex)(s.quota.buckets||[]).forEach((b,i)=>(b.windows||[]).forEach((w,j)=>{if(Number.isFinite(w.remaining))out.push({key:'quota-'+i+'-'+j,label:(b.id==='codex'?'Codex':b.id||'额度')+' · '+(w.minutes===300?'5h':w.minutes===10080?'周':w.minutes+'m')+' 剩余',value:clamp(w.remaining),detail:'可用额度',remaining:true});}));
  if(selected.network&&available.network)out.push({key:'network',label:'网络',value:null,detail:'↓ '+speed(s.network.download)+'  ↑ '+speed(s.network.upload)});
  if(selected.vpn&&available.vpn)out.push({key:'vpn',label:'连接',value:null,detail:s.network.tunnels?.length?'TUN 已开启':s.network.proxyEnabled?'系统代理已开启':'自动代理已配置'});
  return out;
 }
 function trendSeries(history,keys,now=Date.now(),fixedMax=null){
  const samples=(history||[]).filter(p=>p.at>=now-60000&&p.at<=now);
  const max=fixedMax??Math.max(1,...samples.flatMap(p=>keys.map(k=>Number.isFinite(p[k])&&p[k]>=0?p[k]:0)));
  const paths={};for(const key of keys){let d='',previous=null;for(const p of samples){const v=p[key];if(!Number.isFinite(v)||v<0){previous=null;continue;}const x=(p.at-now+60000)/500,y=27-Math.min(max,v)/max*26;d+=(previous!==null&&p.at-previous<=6000?' L':' M')+x.toFixed(1)+' '+y.toFixed(1);previous=p.at;}paths[key]=d.trim();}return {max,paths};
 }
 class HoverGrace{
  constructor(delay=3000){this.delay=delay;this.until=0;}
  hold(now=Date.now()){this.until=now+this.delay;}
  update(inside,now=Date.now()){if(inside)this.hold(now);return inside||now<this.until;}
  reset(){this.until=0;}
 }
 if(typeof module==='object')module.exports={availableHud,systemMetrics,trendSeries,HoverGrace};else {g.availableHud=availableHud;g.systemMetrics=systemMetrics;g.trendSeries=trendSeries;g.HoverGrace=HoverGrace;}
})(typeof window==='undefined'?globalThis:window);
