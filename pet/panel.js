'use strict';
const $ = id => document.getElementById(id);
const speed = n => n === null || n === undefined ? '—' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB/s' : (n / 1024).toFixed(1) + ' KB/s';
const time = n => n ? new Date(n).toLocaleString('zh-CN') : '尚未更新';
function render(s) {
  if (!s) return;
  const q = s.quota;
  $('quota').replaceChildren();
  if (q.status !== 'ready') $('quota').textContent = q.status === 'error' ? q.error : '正在连接 Codex…';
  else if (!q.buckets.length) $('quota').textContent = '当前登录方式没有可用额度数据';
  for (const b of q.status === 'ready' ? q.buckets : []) for (const w of b.windows) {
    const row = document.createElement('div'); row.className = 'quota-row';
    const line = document.createElement('div'); line.className = 'line';
    const label = document.createElement('span'); label.textContent = b.name + ' · ' + (w.minutes === 300 ? '5 小时' : w.minutes === 10080 ? '每周' : (w.minutes || '?') + ' 分钟');
    const value = document.createElement('b'); value.textContent = w.remaining === null ? '未知' : '剩余 ' + w.remaining + '%';
    line.append(label, value); row.append(line);
    if (w.remaining !== null) { const p = document.createElement('progress'); p.max = 100; p.value = w.remaining; p.setAttribute('aria-label', label.textContent); row.append(p); }
    const reset = document.createElement('div'); reset.className = 'muted'; reset.textContent = '重置：' + time(w.resetsAt ? w.resetsAt * 1000 : null); row.append(reset); $('quota').append(row);
  }
  $('quota-time').textContent = '更新：' + time(q.updatedAt) + ' · 每 60 秒刷新';
  $('activity').textContent = ({ working: 'Codex 正在工作', alerting: 'Codex 需要你处理', celebrate: '任务刚刚完成' })[s.activity] || (s.hooks ? '未观察到运行中任务' : '尚未接入工作状态');
  $('hooks').textContent = s.hooks ? '重新连接工作状态' : '接入 Codex 工作状态';
  if (s.bridgeStatus === 'busy') $('activity').textContent = '事件通道被另一实例占用，请退出其他桌宠实例';
  const n = s.network;
  $('download').textContent = speed(n.download); $('upload').textContent = speed(n.upload);
  $('adapter').textContent = n.status === 'error' ? n.error : n.adapters?.length ? '物理网卡：' + n.adapters.join('、') : '等待物理网卡数据';
  $('proxy').textContent = n.status !== 'ready' ? '未知' : n.proxyEnabled ? '已开启' : n.pacConfigured ? '自动配置脚本' : '未开启';
  $('vpn').textContent = n.status !== 'ready' ? '未知' : n.tunnels.length ? n.tunnels.join('、') + ' · 网卡已启用' : '未检测到活动隧道';
  $('notification').textContent = s.notifications;
  const h = s.hardware || {};
  for (const key of ['cpu', 'memory', 'gpu']) $(key).textContent = typeof h[key] === 'number' ? Math.round(h[key]) + '%' : '不可用';
  const gb = bytes => (bytes / 1073741824).toFixed(1) + ' GB';
  $('memory-detail').textContent = h.memoryTotalBytes ? '内存已用 ' + gb(h.memoryUsedBytes) + ' / ' + gb(h.memoryTotalBytes) : '内存数据不可用';
  $('gpu-detail').textContent = 'GPU 按最忙引擎计算' + (typeof h.gpuDedicatedBytes === 'number' ? ' · 专用显存已用 ' + gb(h.gpuDedicatedBytes) : ' · 显存数据不可用');
  $('hardware-hint').textContent = ({ unknown: '等待有效指标', normal: '持续高负载会触发忙碌动画', high: '持续高负载 · 忙碌动画', critical: '持续极高负载 · 紧张动画' })[h.level] || '正在采样';
}
for (const id of ['refresh', 'hooks', 'notifications-on', 'notifications-off', 'test-notice']) $(id).addEventListener('click', async () => {
  $(id).disabled = true;
  try { const result = await window.pet.companion(id); $('feedback').textContent = result.error || (id === 'hooks' ? '已接入。请在新聊天中验证；既有 hooks 已保留。' : id === 'notifications-on' ? '请查看系统授权或通知授权窗口。' : '操作已完成'); }
  catch (e) { $('feedback').textContent = e.message; }
  finally { $(id).disabled = false; }
});
window.pet.onStats(render); window.pet.stats().then(render);
