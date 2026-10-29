'use strict';
const sources=new Set(['edge','chrome','thunder','baidu','install']);const states=new Set(['active','paused','complete','interrupted','unknown']);
class TransferTracker{
 constructor(){this.tasks=new Map();this.recent=null;this.enabled=Object.fromEntries([...sources].map(s=>[s,true]));}
 accept(e,now=Date.now()){return e&&this.enabled[e.source]?this.update(e,now):null;}
 setEnabled(source,enabled){if(!sources.has(source))throw new Error('Invalid source');this.enabled[source]=enabled===true;if(!enabled)this.clear(source);}
 update(e,now=Date.now()){
  if(!e||!sources.has(e.source)||typeof e.id!=='string'||!e.id||e.id.length>128||!states.has(e.state))throw new Error('Invalid transfer event');
  const received=e.received==null?null:e.received,total=e.total==null?null:e.total;
  if(received!==null&&(!Number.isFinite(received)||received<0)||total!==null&&(!Number.isFinite(total)||total< -1)||received!==null&&total>0&&received>total)throw new Error('Invalid byte progress');
  const percent=e.percent==null?null:e.percent;if(percent!==null&&(!Number.isFinite(percent)||percent<0||percent>100))throw new Error('Invalid percentage');
  const key=e.source+':'+e.id,old=this.tasks.get(key),known=total>0&&received!==null;
  const task={source:e.source,id:e.id,name:typeof e.name==='string'?e.name.replace(/[\x00-\x1f]/g,'').slice(0,120):old?.name||'',state:e.state,progress:percent!==null?Math.round(percent):known?Math.min(100,Math.round(received/total*100)):null,received,total,at:now};
  let event=null;if((e.state==='complete'||e.state==='interrupted')&&old&&['active','paused'].includes(old.state)){event=e.state;this.recent={event,at:now};}
  this.tasks.set(key,task);if(this.tasks.size>100)this.tasks.delete(this.tasks.keys().next().value);
  return {...this.view(now),event};
 }
 view(now=Date.now()){
  for(const [key,t] of this.tasks)if(now-t.at>60000)this.tasks.delete(key);
  const tasks=[...this.tasks.values()].sort((a,b)=>(b.state==='active')-(a.state==='active')||b.at-a.at);
  const recent=this.recent&&now-this.recent.at<4000?this.recent:null;
  return {tasks,animation:recent?(recent.event==='complete'?'excited':'sad'):tasks.some(t=>t.state==='active')?(tasks.find(t=>t.state==='active').progress===null?'receiving':'progress'):null};
 }
 clear(source){for(const [key,t]of this.tasks)if(t.source===source)this.tasks.delete(key);this.recent=null;}
}
module.exports={TransferTracker};
