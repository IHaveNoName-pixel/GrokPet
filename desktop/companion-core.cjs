'use strict';
function quotas(result) {
  const buckets = result?.rateLimitsByLimitId || (result?.rateLimits ? { codex: result.rateLimits } : {});
  return Object.entries(buckets).filter(([, value]) => value).map(([id, value]) => ({
    id, name: value.limitName || id,
    windows: ['primary', 'secondary'].filter(key => value[key]).map(key => {
      const w = value[key];
      return { key, remaining: typeof w.usedPercent === 'number' && Number.isFinite(w.usedPercent) ? Math.max(0, Math.min(100, 100 - w.usedPercent)) : null,
        minutes: w.windowDurationMins ?? null, resetsAt: w.resetsAt ?? null };
    }),
  }));
}
class Throughput {
  constructor() { this.before = new Map(); this.at = 0; }
  sample(adapters, at) {
    let rx = 0, tx = 0, count = 0;
    const seconds = (at - this.at) / 1000;
    const next = new Map();
    for (const a of adapters.filter(a => a.physical)) {
      next.set(a.id, a);
      const old = this.before.get(a.id);
      if (old && seconds > 0 && a.rx >= old.rx && a.tx >= old.tx) { rx += a.rx - old.rx; tx += a.tx - old.tx; count++; }
    }
    this.before = next; this.at = at;
    return { download: count ? rx / seconds : null, upload: count ? tx / seconds : null };
  }
}
const EVENTS = ['UserPromptSubmit','PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'Interrupt'];
class Activity {
  constructor() { this.tasks = new Map(); this.done = new Map(); this.lastTurns = new Map(); this.sequence = 0; this.celebrateUntil = 0;this.outcome=null; }
  event(e, now = Date.now()) {
    if (!EVENTS.includes(e?.event) || typeof e.session !== 'string') return null;
    if (e.turn && this.done.has(e.session + ':' + e.turn)) return null;
    const current=this.tasks.get(e.session);
    if(e.event!=='UserPromptSubmit'&&current?.turn&&!current.synthetic&&e.turn&&e.turn!==current.turn)return null;
    const turn = e.turn || (e.event === 'UserPromptSubmit' ? 'local-' + (++this.sequence) : this.tasks.get(e.session)?.turn || this.lastTurns.get(e.session) || 'current');
    if (e.turn && this.tasks.get(e.session)?.synthetic) {
      this.tasks.get(e.session).turn = e.turn;
      this.tasks.get(e.session).synthetic = false;
      this.lastTurns.set(e.session, e.turn);
    }
    const key = e.session + ':' + turn;
    if (e.event === 'UserPromptSubmit') this.lastTurns.set(e.session, turn);
    if (e.event === 'Stop' || e.event === 'Interrupt') {
      if (this.done.has(key)) return null;
      this.done.set(key, now);
      const active = this.tasks.get(e.session);
      if (!active?.turn || !e.turn || active.turn === e.turn) this.tasks.delete(e.session);
      if (this.done.size > 200) this.done.delete(this.done.keys().next().value);
      const failed=e.event==='Stop'&&active?.failed===true;
      if (e.event === 'Stop') {this.celebrateUntil = now + 5000;this.outcome={failed,at:now};}
      return { id: key + ':' + e.event, source: 'Codex', title: e.event==='Interrupt'?'任务已中断':failed?'本轮结束，最后工具状态为失败':'任务已完成', body: typeof e.message === 'string' ? e.message.slice(0, 240) : '' };
    }
    const active = this.tasks.get(e.session);
    if (e.event === 'PostToolUse' && active?.turn && e.turn && active.turn !== e.turn) return null;
    if (e.event === 'PostToolUse' && this.done.has(key)) return null;
    const task=e.event==='UserPromptSubmit'||!active?{tools:new Map(),completed:new Set(),failed:false,confusedUntil:0}:active;
    task.tools||=new Map();
    task.completed||=new Set();
    if(['PreToolUse','PostToolUse'].includes(e.event)&&e.toolId&&task.completed.has(e.toolId))return null;
    if(e.event==='PreToolUse')task.tools.set(e.toolId||'current',{phase:['searching','writing'].includes(e.phase)?e.phase:'working',at:now});
    if(e.event==='PostToolUse'){
      task.tools.delete(e.toolId||'current');task.failed=e.failed===true;
      if(e.toolId){task.completed.add(e.toolId);if(task.completed.size>500)task.completed.delete(task.completed.values().next().value);}
      task.confusedUntil=task.failed?now+3500:0;
    }
    Object.assign(task,{state:e.event==='PermissionRequest'?'alerting':'thinking',at:now,turn,synthetic:!e.turn&&turn.startsWith('local-')});
    this.tasks.set(e.session,task);
    if(this.tasks.size>100)this.tasks.delete(this.tasks.keys().next().value);
    return e.event === 'PermissionRequest' ? { id: key + ':approval', source: 'Codex', title: '需要你处理', body: 'Codex 正在等待审批，请回到原聊天确认。',priority:'urgent' } : null;
  }
  state(now = Date.now()) {
    const active = [...this.tasks.values()].filter(t => now - t.at < 30 * 60 * 1000);
    if (active.some(t => t.state === 'alerting')) return 'alerting';
    if (active.length) {
      const latest=active.sort((a,b)=>b.at-a.at)[0];
      if(now<latest.confusedUntil)return 'confused';
      const tool=[...(latest.tools?.values()||[])].sort((a,b)=>b.at-a.at)[0];
      return tool?.phase||'thinking';
    }
    return now<this.celebrateUntil?(this.outcome?.failed?'sad':now-(this.outcome?.at||0)<1500?'proud':'celebrate'):null;
  }
}
function mergeHooks(existing, command) {
  const result = structuredClone(existing || {});
  result.hooks ||= {};
  for (const event of EVENTS) {
    const groups = result.hooks[event] || [];
    const clean = groups.map(g => ({ ...g, hooks: g.hooks.filter(h => !h.command?.includes(' --blob-pet')) })).filter(g => g.hooks.length);
    clean.push({ hooks: [{ type: 'command', command: command + ' --blob-pet --event ' + event, timeout: 2 }] });
    result.hooks[event] = clean;
  }
  return result;
}
class NoticeQueue {
  constructor() { this.queue = []; this.seen = new Map(); this.nextAt = 0; }
  push(n, now = Date.now()) {
    if (!n || typeof n.id !== 'string' || this.seen.has(n.id)) return false;
    this.seen.set(n.id, now);
    if (this.seen.size > 300) this.seen.delete(this.seen.keys().next().value);
    const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max) : '';
    const notice={id:n.id,source:text(n.source,40),title:text(n.title,80),body:text(n.body,240),priority:n.priority==='urgent'?'urgent':'normal'};
    if(notice.priority==='urgent'){this.queue.unshift(notice);this.nextAt=0;}else this.queue.push(notice);
    if(this.queue.length>20){const index=this.queue.findIndex(item=>item.priority!=='urgent');this.queue.splice(index<0?this.queue.length-1:index,1);}
    return true;
  }
  next(now = Date.now(), quiet = false) {
    if (now < this.nextAt || !this.queue.length) return null;
    const index=quiet?this.queue.findIndex(n=>n.priority==='urgent'):0;if(index<0)return null;
    this.nextAt = now + 8000;
    return this.queue.splice(index,1)[0];
  }
}
class LoadMonitor {
  configure(value={}) {const next={cpu:85,memory:90,gpu:90,seconds:8,...value};if(JSON.stringify(next)!==JSON.stringify(this.threshold)){this.badSince=this.extremeSince=this.calmSince=null;this.level='normal';}this.threshold=next;}
  constructor() { this.threshold={cpu:85,memory:90,gpu:90,seconds:8};this.badSince = null; this.extremeSince = null; this.calmSince = null; this.level = 'normal'; }
  sample(h, now = Date.now()) {
    const known = ['cpu', 'memory', 'gpu'].some(k => typeof h?.[k] === 'number' && Number.isFinite(h[k]));
    if (!known) { this.badSince = this.extremeSince = this.calmSince = null; this.level = 'unknown'; return { level: 'unknown', animation: null }; }
    if (this.level === 'unknown') this.level = 'normal';
    const high = h.cpu >= this.threshold.cpu || h.memory >= this.threshold.memory || h.gpu >= this.threshold.gpu;
    const extreme = h.cpu >= 97 || h.memory >= 97 || h.gpu >= 97;
    if (high) { this.badSince ??= now; this.calmSince = null; } else this.badSince = null;
    if (extreme) this.extremeSince ??= now; else this.extremeSince = null;
    if (this.extremeSince !== null && now - this.extremeSince >= 8000) this.level = 'critical';
    else if (this.badSince !== null && now - this.badSince >= this.threshold.seconds*1000) this.level = 'high';
    if (['cpu', 'memory', 'gpu'].every(k => h[k] === null || h[k] === undefined || h[k] < Math.min(75,this.threshold[k]-10))) {
      this.calmSince ??= now; if (now - this.calmSince >= 15000) this.level = 'normal';
    } else this.calmSince = null;
    return { level: this.level, animation: this.level === 'critical' ? 'scared' : this.level === 'high' ? 'humming' : null };
  }
}
module.exports = { quotas, Throughput, Activity, mergeHooks, NoticeQueue, EVENTS, LoadMonitor };
