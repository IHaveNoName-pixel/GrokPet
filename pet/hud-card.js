'use strict';
// DOM adaptation of Cult UI Expandable / Halo Progress patterns (MIT).
// Keep the existing SVG renderer independent; no second owner of its DOM.
(()=>{
 const card=document.getElementById('telemetry'),toggle=document.getElementById('system-toggle'),summary=document.getElementById('system-summary'),details=document.getElementById('system-details'),list=document.getElementById('system-metrics');
 const icons={cpu:'M4 7h16v10H4z M8 3v4m8-4v4M8 17v4m8-4v4M1 10h3m-3 4h3m16-4h3m-3 4h3',memory:'M3 6h18v12H3z M7 9v5m5-5v5m5-5v5M6 18v3m6-3v3m6-3v3',gpu:'M3 5h17v13H3z M20 9h3m-3 5h3M7 18v3 M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0',quota:'M8 5 2 12l6 7m8-14 6 7-6 7m-3-16-2 18',network:'M7 3v17m-4-4 4 4 4-4M17 21V4m-4 4 4-4 4 4',vpn:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z'};
 function icon(key){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',icons[key.startsWith('quota')?'quota':key]);svg.append(p);return svg;}
 let expanded=false,signature='',resizeTimer,collapsing=false;
 function fit(){if(document.body.classList.contains('radial-open'))return;if(collapsing)return;clearTimeout(resizeTimer);const dock=document.getElementById('info-dock');const target=expanded&&!card.hidden&&document.body.dataset.hudMode!=='hidden'?Math.ceil(dock.getBoundingClientRect().bottom-details.getBoundingClientRect().height+Math.min(list.scrollHeight,320)+14):Math.ceil(dock.getBoundingClientRect().bottom+14);const visible=!document.body.classList.contains('dragging')&&(document.body.dataset.hudMode==='always'||document.body.dataset.hudMode==='hover'&&document.body.classList.contains('hover')||document.body.classList.contains('quick-open'));window.pet.dockHeight(visible?Math.max(480,Math.min(900,target)):480,visible);}
 function setExpanded(value){if(value===expanded)return;clearTimeout(resizeTimer);collapsing=false;expanded=value;if(value)for(const id of ['focus-details','load-details']){const el=document.getElementById(id);if(el)el.open=false;}toggle.setAttribute('aria-expanded',String(value));details.inert=!value;card.classList.toggle('expanded',value);if(value)fit();else {collapsing=true;resizeTimer=setTimeout(()=>{collapsing=false;fit();},350);}}
 toggle.addEventListener('click',()=>window.pet.quickAction({type:'open',mode:'system'}));card.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){window.holdDockHover?.();setExpanded(false);toggle.focus();}});
 function render(snapshot,settings){
  const metrics=systemMetrics(snapshot,settings);card.hidden=!metrics.length||settings?.dockItems?.system===false;
  if(card.hidden||settings?.hudMode==='hidden')setExpanded(false);
  const next=JSON.stringify([snapshot.history,metrics,settings?.summaryItems,settings?.summaryOrder,settings?.summaryMax]);if(next===signature){fit();return;}signature=next;
  summary.replaceChildren();
  const oldRows=new Map([...list.children].map(row=>[row.dataset.metric,row]));
  for(const row of list.children)if(!metrics.some(m=>m.key===row.dataset.metric))row.remove();
  for(const m of metrics){
   const existing=oldRows.get(m.key);
   if(existing){existing.querySelector('.metric-label').lastChild.textContent=m.label;const fill=existing.querySelector('.halo-track i'),bar=existing.querySelector('.halo-track');if(fill){fill.style.transform='scaleX('+m.value/100+')';existing.querySelector('strong').textContent=Math.round(m.value)+'%';bar.setAttribute('aria-valuenow',m.value);bar.classList.toggle('high',!m.remaining&&m.value>=85);}existing.querySelector('small').textContent=m.detail;list.append(existing);continue;}
   const row=document.createElement('div');row.className='metric-row';row.dataset.metric=m.key;
   const label=document.createElement('div');label.className='metric-label';label.append(icon(m.key),document.createTextNode(m.label));row.append(label);
   if(m.value!==null){const value=document.createElement('strong');value.textContent=Math.round(m.value)+'%';row.append(value);const bar=document.createElement('div');bar.className='halo-track';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',m.label);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',m.value);const fill=document.createElement('i');fill.style.transform='scaleX('+m.value/100+')';bar.classList.toggle('quota',!!m.remaining);bar.classList.toggle('high',!m.remaining&&m.value>=85);bar.append(fill);row.append(bar);}
   const detail=document.createElement('small');detail.textContent=m.detail;row.append(detail);list.append(row);
  }
  for(const key of ['cpu','memory','gpu','network']){
   const row=[...list.children].find(r=>r.dataset.metric===key);if(!row)continue;
   const network=key==='network',keys=network?['download','upload']:[key];const trend=trendSeries(snapshot.history,keys,Date.now(),network?null:100);
   let svg=row.querySelector('.metric-trend');if(!svg){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('metric-trend');svg.setAttribute('viewBox','0 0 120 28');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');row.append(svg);}
   svg.setAttribute('aria-label',network?'网络最近一分钟趋势，下载蓝线，上传绿线，共用速度刻度':({cpu:'CPU',memory:'内存',gpu:'GPU'})[key]+' 最近一分钟趋势，纵轴 0 至 100%');svg.replaceChildren();
   for(const k of keys){const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',trend.paths[k]);line.classList.add('trend-'+k);svg.append(line);}
   const title=document.createElementNS(svg.namespaceURI,'title');title.textContent='最近 60 秒；空白表示未采样或数据不可用';svg.append(title);
   if(network){let legend=row.querySelector('.trend-legend');if(!legend){legend=document.createElement('small');legend.className='trend-legend';row.append(legend);}const rate=n=>n>=1048576?(n/1048576).toFixed(1)+' MB/s':(n/1024).toFixed(1)+' KB/s';legend.textContent='↓ 下载（蓝） · ↑ 上传（绿） · 刻度 0–'+rate(trend.max);}
  }
  const selected=settings?.summaryItems||{cpu:true,memory:true,gpu:true};
  const order=settings?.summaryOrder||['cpu','memory','gpu','codex','network','vpn'];const shown=metrics.filter(m=>selected[m.key.startsWith('quota')?'codex':m.key]).sort((a,b)=>order.indexOf(a.key.startsWith('quota')?'codex':a.key)-order.indexOf(b.key.startsWith('quota')?'codex':b.key)).slice(0,settings?.summaryMax||12);
  for(const m of shown){const chip=document.createElement('span');chip.className='summary-chip';if(m.value!==null){const ring=document.createElement('span');ring.className='load-ring';ring.style.setProperty('--load',m.value+'%');ring.classList.toggle('high',!m.remaining&&m.value>=85);ring.append(icon(m.key));chip.append(ring,document.createTextNode(m.label+' '+Math.round(m.value)+'%'));}else chip.append(icon(m.key),document.createTextNode(m.detail));const textNode=[...chip.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(textNode){const text=document.createElement('span');text.className='summary-text';text.textContent=textNode.textContent;textNode.replaceWith(text);}summary.append(chip);}
  if(!shown.length)summary.textContent='系统信息';
  card.setAttribute('aria-label','系统信息，'+metrics.length+' 项');fit();
 }
 window.systemCard={render,fit,setExpanded,makeIcon:icon};window.addEventListener('resize',()=>{if(typeof updateMusicControls==='function')updateMusicControls();});
 new ResizeObserver(()=>{fit();if(typeof updateMusicControls==='function')updateMusicControls();}).observe(document.getElementById('info-dock'));
})();


