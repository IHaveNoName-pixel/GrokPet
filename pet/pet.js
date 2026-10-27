'use strict';
const hit = document.getElementById('pet-hit');
const bubble = document.getElementById('bubble');
let settings, bot, press, bubbleTimer, hidden = false;
let currentState = 'idle';

function say(text, duration = 2600) {
  clearTimeout(bubbleTimer);
  if (!settings?.bubbles || hidden) return;
  bubble.textContent = text;
  bubble.classList.add('show');
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
}

function updatePause() {
  if (!bot) return;
  const pause = !!settings.paused || hidden;
  bot.setPaused(pause);
  // The original engine schedules RAF even when paused. Cancel it while inactive.
  cancelAnimationFrame(bot._raf);
  if (!pause) {
    bot.last = performance.now();
    bot._raf = requestAnimationFrame(t => bot._tick(t));
  }
}

function applySettings(value) {
  settings = value;
  document.documentElement.style.setProperty('--pet-size', `${value.size}px`);
  if (bot) { bot.setShape(value.shape); bot.setColor(value.color, 'light'); }
  if (!value.bubbles) bubble.classList.remove('show');
  updatePause();
}

function applyState(state) {
  if (!bot || state === currentState) return;
  currentState = state;
  bot.setState(state);
  if (state === 'waking') say('醒啦，陪你一会儿');
  if (state === 'sleeping') say('我在这里打个盹…');
  if (state === 'drowsy') say('有一点点困了');
}

function stroke() {
  window.pet.action('pet');
  if (!settings?.paused) { bot.bounceOnce(); say(['嘿嘿，舒服～', '我在呢', '今天也陪着你'][Math.floor(Math.random() * 3)]); }
}
function speed(value) {
  if (value === null || value === undefined) return '—';
  if (value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + ' MB/s';
  return (value / 1024).toFixed(1) + ' KB/s';
}
function stats(value) {
  if (!value) return;
  const quota = value.quota;
  const windows = (quota.buckets.find(b => b.id === 'codex') || quota.buckets[0])?.windows || [];
  document.getElementById('quota-line').textContent = quota.status === 'ready'
    ? 'Codex ' + (windows.length ? windows.map(w => (w.minutes === 300 ? '5小时' : w.minutes === 10080 ? '每周' : (w.minutes || '?') + '分钟') + ' 剩余 ' + (w.remaining === null ? '未知' : w.remaining + '%')).join(' · ') : '当前账号无额度数据')
    : quota.status === 'error' ? 'Codex 暂不可用 · 右键查看' : 'Codex 连接中…';
  const n = value.network;
  document.getElementById('network-line').textContent = n.status === 'ready'
    ? '↓ ' + speed(n.download) + '  ↑ ' + speed(n.upload) + ' · ' + (n.tunnels.length ? 'TUN 已启用' : n.proxyEnabled ? '系统代理开' : '代理关')
    : '网络指标暂不可用';
  const h = value.hardware || {};
  const percent = n => typeof n === 'number' ? Math.round(n) + '%' : '—';
  document.getElementById('hardware-line').textContent = 'CPU ' + percent(h.cpu) + ' · 内存 ' + percent(h.memory) + ' · GPU ' + percent(h.gpu);
}
hit.addEventListener('dblclick', () => window.pet.companion('panel'));
window.pet.onStats(stats);
window.pet.stats().then(stats);
window.pet.onNotice(notice => say(notice.source + ' · ' + notice.title + (notice.body ? '\n' + notice.body : ''), 7500));

hit.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  press = { id: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
  hit.setPointerCapture(event.pointerId);
});
hit.addEventListener('pointermove', event => {
  if (!press || settings?.paused || press.dragging) return;
  if (Math.hypot(event.screenX - press.x, event.screenY - press.y) > 5) {
    press.dragging = true;
    hit.classList.add('dragging'); document.body.classList.add('dragging');
    bubble.classList.remove('show');
    window.pet.action('drag-start');
  }
});
function release(cancelled = false) {
  if (!press) return;
  const wasDragging = press.dragging;
  const id = press.id;
  press = null;
  if (hit.hasPointerCapture(id)) hit.releasePointerCapture(id);
  hit.classList.remove('dragging'); document.body.classList.remove('dragging');
  if (wasDragging) window.pet.action('drag-end');
  else if (!cancelled) stroke();
}
hit.addEventListener('pointerup', () => release());
hit.addEventListener('pointercancel', () => release(true));
hit.addEventListener('lostpointercapture', () => release(true));
window.addEventListener('blur', () => release(true));
hit.addEventListener('contextmenu', event => { event.preventDefault(); window.pet.action('menu'); });
hit.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); stroke(); }
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); window.pet.action('menu'); }
});
window.pet.onState(applyState);
window.pet.onSettings(applySettings);
window.pet.onVisibility(value => { hidden = !value; if (hidden) bubble.classList.remove('show'); updatePause(); });
window.pet.onGaze(point => {
  if (!bot) return;
  bot.rectAt = -Infinity;
  bot.setGazeTarget(point);
  const r = hit.getBoundingClientRect();
  document.body.classList.toggle('hover', point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom);
});

window.pet.ready().then(value => {
  settings = value;
  bot = new GrokCharacter(document.getElementById('character'), {
    mode: 'hold', shape: value.shape, color: value.color, scheme: 'light', loginWrap: true,
    state: 'idle', followPointer: false,
  });
  applySettings(value);
  applyState(value.state || 'idle');
  say('你好，摸摸我吧 · 右键可以设置', 5000);
}).catch(error => { document.body.dataset.error = error.message; console.error(error); });
