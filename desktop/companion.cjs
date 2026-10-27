'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { quotas, Throughput, Activity, NoticeQueue, LoadMonitor } = require('./companion-core.cjs');
const { CodexClient } = require('./codex-client.cjs');
const { installHooks, hooksInstalled } = require('./hook-config.cjs');

class Companion {
  constructor(root, publish, options = {}) {
    this.root = root; this.publish = publish;
    this.channel = options.channel || crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 12);
    this.codex = new CodexClient(); this.flow = new Throughput(); this.activity = new Activity(); this.queue = new NoticeQueue();
    this.load = new LoadMonitor(); this.lastLoadNotice = 0;
    this.bridge = [path.join(root, 'bridge/BlobPetBridge.exe'), path.join(root, '.runtime/bridge/BlobPetBridge.exe')].find(fs.existsSync);
    this.snapshot = { quota: { status: 'loading', buckets: [], updatedAt: null }, network: { status: 'loading', download: null, upload: null, tunnels: [] },
      notifications: '未启用', hooks: hooksInstalled(), bridgeStatus:'starting', activity: null, hardware: {cpu:null,memory:null,gpu:null,level:'unknown',animation:null} };
    this.children = new Set(); this.stopped = false; this.busy = false; this.notificationChild = null;
  }
  emit() { this.snapshot.activity = this.activity.state(); this.publish(this.snapshot); }
  start() {
    this.stopped = false;
    if (this.bridge) this.metrics = this.launch(['--metrics'], m => this.receive(m));
    else { this.snapshot.network = { ...this.snapshot.network, status: 'error', error: '缺少 Windows 桥接程序' }; }
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 60000);
    this.stateTimer = setInterval(() => this.emit(), 1000);
    this.emit();
  }
  launch(args, receive) {
    const child = spawn(this.bridge, [...args, '--channel', this.channel, '--parent', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.children.add(child);
    let buffer = '';
    child.stdout.on('data', c => {
      buffer += c;
      if (buffer.length > 1024 * 1024) { child.kill(); return; }
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const raw = buffer.slice(0, at); buffer = buffer.slice(at + 1);
        try { receive(JSON.parse(raw)); } catch (error) { console.error('Bridge data:', error.message); }
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', () => {
      if (args.includes('--metrics')) this.invalidateMetrics('系统指标桥接无法启动');
      else this.snapshot.notifications = '桥接无法启动';
      this.emit();
    });
    child.on('exit', () => {
      this.children.delete(child);
      if (this.notificationChild === child) {
        this.notificationChild = null;
        if (['已启用', '等待授权'].includes(this.snapshot.notifications)) this.snapshot.notifications = '已停止';
      }
      if (this.metrics === child && !this.stopped) {
        this.invalidateMetrics('系统指标连接已关闭，正在重新连接');
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => { if (!this.stopped) this.metrics = this.launch(['--metrics'], m => this.receive(m)); }, 5000);
      }
      this.emit();
    });
    return child;
  }
  invalidateMetrics(reason) {
    this.flow = new Throughput(); this.load = new LoadMonitor();
    this.snapshot.bridgeStatus = 'disconnected';
    this.snapshot.network = { status:'error', error:reason, download:null, upload:null, tunnels:[] };
    this.snapshot.hardware = {cpu:null,memory:null,gpu:null,level:'unknown',animation:null};
  }
  async refresh() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const data = await this.codex.readLimits();
      if (!this.stopped) this.snapshot.quota = { status: 'ready', buckets: quotas(data), updatedAt: Date.now() };
    } catch (error) {
      if (!this.stopped) this.snapshot.quota = { ...this.snapshot.quota, status: 'error', error: error.message.slice(0, 180) };
    } finally { this.busy = false; if (!this.stopped) this.emit(); }
  }
  receive(m) {
    if (m.kind === 'metrics') {
      const speeds = this.flow.sample(m.adapters, m.at);
      this.snapshot.network = { status: 'ready', ...speeds, updatedAt: m.at, proxyEnabled: !!m.proxyEnabled, pacConfigured: !!m.pacConfigured,
        tunnels: m.tunnels, adapters: m.adapters.filter(a => a.physical).map(a => a.name) };
      const previousLevel = this.snapshot.hardware.level;
      this.snapshot.hardware = { ...m.hardware, ...this.load.sample(m.hardware || {}, m.at), updatedAt: m.at };
      if (['high', 'critical'].includes(this.snapshot.hardware.level) && previousLevel !== this.snapshot.hardware.level && Date.now() - this.lastLoadNotice > 60000) {
        this.lastLoadNotice = Date.now();
        const h = this.snapshot.hardware;
        this.queue.push({ id:'load:' + this.lastLoadNotice, source:'系统负载', title:h.level === 'critical' ? '负载持续很高' : '电脑有点忙',
          body:['cpu','memory','gpu'].filter(k => typeof h[k] === 'number').map(k => ({cpu:'CPU',memory:'内存',gpu:'GPU'})[k] + ' ' + Math.round(h[k]) + '%').join(' · ') });
      }
    } else if (m.kind === 'bridge') this.snapshot.bridgeStatus = m.status;
    else if (m.kind === 'codex') {
      const n = this.activity.event(m); if (n) this.queue.push(n);
    } else if (m.kind === 'notification') this.queue.push({ ...m, id: 'windows:' + m.id });
    else if (m.kind === 'permission') this.snapshot.notifications = ({ Allowed: '已启用', Denied: '系统未允许', Unspecified: '等待授权', Unavailable: '系统接口不可用' })[m.status] || m.status;
    else if (m.kind === 'error') this.snapshot.notifications = m.message || '读取失败';
    this.emit();
  }
  nextNotice() { return this.queue.next(); }
  enableNotifications() {
    if (!this.bridge) throw new Error('缺少 Windows 桥接程序');
    if (this.notificationChild) return;
    this.snapshot.notifications = '等待授权';
    this.notificationChild = this.launch(['--notifications'], m => this.receive(m));
    this.emit();
  }
  disableNotifications() {
    this.notificationChild?.kill(); this.notificationChild = null; this.snapshot.notifications = '未启用'; this.emit();
  }
  installHooks() {
    const file = installHooks(this.bridge, undefined, this.channel);
    this.snapshot.hooks = true; this.emit(); return file;
  }
  stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer); clearInterval(this.stateTimer);
    clearTimeout(this.restartTimer);
    this.codex.stop();
    for (const child of this.children) child.kill();
    this.children.clear();
  }
}
module.exports = { Companion };
