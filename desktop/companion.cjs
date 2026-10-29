'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { quotas, Throughput, Activity, NoticeQueue, LoadMonitor } = require('./companion-core.cjs');
const { CodexClient } = require('./codex-client.cjs');
const { installHooks, hooksInstalled } = require('./hook-config.cjs');
const {MusicClock,lyricAt,trackKey}=require('./music-core.cjs');
const {LyricsStore}=require('./lyrics-store.cjs');
const {ReminderStore}=require('./local-commands.cjs');
const {FocusTimer,MetricHistory}=require('./focus.cjs');
const {TransferTracker}=require('./transfer-core.cjs');const {TransferProbeMonitor}=require('./transfer-monitor.cjs');

class Companion {
  constructor(root, publish, options = {}) {
    this.root = root; this.publish = publish;
    this.channel = options.channel || crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 12);
    this.codex = new CodexClient(); this.flow = new Throughput(); this.activity = new Activity(); this.queue = new NoticeQueue();
    this.reminders=new ReminderStore(path.join(options.dataDir||path.join(root,'.runtime','user-data'),'reminders.json'));this.reminderSeen=new Set();this.focus=new FocusTimer(path.join(options.dataDir||path.join(root,'.runtime','user-data'),'focus.json'));this.history=new MetricHistory();this.wasFocusing=false;this.load = new LoadMonitor();this.load.configure(options.loadThresholds); this.lastLoadNotice = 0;
    this.music=new MusicClock();this.musicEnabled=options.musicEnabled!==false;this.musicBubbles=options.musicBubbles!==false;this.musicChild=null;this.audioOutput=options.audioPeak||(()=>{});this.audioChild=null;
    this.lyrics=new LyricsStore(path.join(options.dataDir||path.join(root,'.runtime','user-data'),'lyrics.json'));
    this.bridge = [path.join(root, 'bridge/BlobPetBridge.exe'), path.join(root, '.runtime/bridge/BlobPetBridge.exe')].find(fs.existsSync);
    this.transfer=new TransferTracker();this.transferSources=options.transferSources||{};for(const key of ['edge','chrome','thunder','baidu','install'])this.transfer.setEnabled(key,this.transferSources[key]===true);
    this.transferProbe=new TransferProbeMonitor(this.bridge,(source,data)=>this.receiveProbe(source,data));this.transferProbe.configure(this.transferSources);this.probeSeen=new Set();this.transferStatus=Object.fromEntries(['edge','chrome','thunder','baidu','install'].map(k=>[k,this.transferSources[k]?(k==='edge'||k==='chrome'?'等待浏览器扩展':'等待检测'):'未启用']));
    this.controlMedia=require('./media-control.cjs').createMediaController(this.bridge);
    this.snapshot = { quota: { status: 'loading', buckets: [], updatedAt: null }, network: { status: 'loading', download: null, upload: null, tunnels: [] },
      notifications: '未启用', hooks: hooksInstalled(), bridgeStatus:'starting', activity: null, hardware: {cpu:null,memory:null,gpu:null,level:'unknown',animation:null},media:this.music.view() };
    this.children = new Set(); this.stopped = false; this.busy = false; this.notificationChild = null;
  }
  emit() {
    try{const due=this.reminders.due();this.reminders.markDue(due.map(x=>x.id));for(const item of this.reminders.items.filter(x=>x.status==='due')){const key=item.id+':'+item.dueAt;if(this.reminderSeen.has(key))continue;this.queue.push({id:'reminder:'+key,source:'提醒',title:item.title,body:'已到提醒时间，可在提醒待办中完成或稍后提醒。',priority:item.important?'urgent':'normal'});this.reminderSeen.add(key);if(this.reminderSeen.size>1000)this.reminderSeen.delete(this.reminderSeen.values().next().value);}}catch(error){this.reminders.error=error.message;}
    this.queue.queue=this.queue.queue.filter(n=>!n.id.startsWith('reminder:')||this.reminders.items.some(x=>x.status==='due'&&n.id==='reminder:'+x.id+':'+x.dueAt));
    this.snapshot.reminders={items:this.reminders.items,error:this.reminders.error};

    const focus=this.focus.view();this.snapshot.focus=focus;this.snapshot.history=this.history.view();
    if(this.wasFocusing&&!focus.active){const held=this.queue.queue.filter(n=>n.priority!=='urgent').length;this.queue.queue=this.queue.queue.filter(n=>n.priority==='urgent');if(held)this.queue.push({id:'focus-summary:'+Date.now(),source:'专注',title:'专注期间暂缓了 '+held+' 条普通提示',body:'旧提示已合并，不逐条重放。'});}
    this.wasFocusing=focus.active;
    if(this.focus.consumeCompletion()){this.queue.push({id:'focus-complete:'+Date.now(),source:'专注',title:'本次专注已完成',priority:'urgent'});}

    this.snapshot.activity = this.activity.state();this.snapshot.transfers={...this.transfer.view(),status:{...this.transferStatus}};
    if(this.music.raw.status==='ready'&&Number.isFinite(this.music.raw.observedAt)&&Date.now()-this.music.raw.observedAt>6000)
      this.music.ingest({status:'error',reason:'媒体信息已过期，等待网易云更新'});
    const media=this.music.view();const lyrics=this.lyrics.forTrack(media);
    this.snapshot.media={...media,lyricsName:lyrics?.name||null,lyric:lyrics&&media.positionMs!==null?lyricAt(lyrics.lines,media.positionMs):null};
    this.publish(this.snapshot);
  }
  start() {
    this.stopped = false;
    if (this.bridge) this.metrics = this.launch(['--metrics'], m => this.receive(m));
    else { this.snapshot.network = { ...this.snapshot.network, status: 'error', error: '缺少 Windows 桥接程序' }; }
    this.refresh();this.transferProbe.start();
    if(this.musicEnabled&&this.bridge){this.musicChild=this.launch(['--media'],m=>this.receive(m));}
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
      else if(args.includes('--media'))this.music.ingest({status:'error',reason:'媒体桥接无法启动'});
      else this.snapshot.notifications = '桥接无法启动';
      this.emit();
    });
    child.on('exit', () => {
      this.children.delete(child);
      if(this.musicChild===child){
        this.musicChild=null;
        if(!this.stopped&&this.musicEnabled){
          this.music.ingest({status:'error',reason:'媒体连接已关闭，正在重新连接'});
          clearTimeout(this.musicRestartTimer);this.musicRestartTimer=setTimeout(()=>{if(!this.stopped&&this.musicEnabled)this.musicChild=this.launch(['--media'],m=>this.receive(m));},5000);
        }
      }
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
    this.flow = new Throughput();const threshold=this.load.threshold;this.load=new LoadMonitor();this.load.configure(threshold);this.history.sample({});
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
      this.history.sample({...m.hardware,...speeds});
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
    } else if(m.kind==='transfer'){
      try{const result=this.transfer.accept(m);if(result?.event){const label={edge:'Edge',chrome:'Chrome',thunder:'迅雷',baidu:'百度网盘',install:'安装'}[m.source];this.queue.push({id:'transfer:'+m.source+':'+m.id+':'+result.event,source:label,title:result.event==='complete'?'下载完成':'下载中断',body:typeof m.name==='string'?m.name.slice(0,120):''});}if(result)this.transferStatus[m.source]='已连接';}catch{}
    } else if(m.kind==='media'){
      if(!this.musicEnabled)return;
      const before=trackKey(this.music.raw);
      const wasPlaying=this.music.raw.state==='playing';
      const text=v=>typeof v==='string'?v.slice(0,200):'';
      const media={...m,title:text(m.title),artist:text(m.artist),album:text(m.album)};
      this.music.ingest(media);
      const key=trackKey(media);
      if(key!==before||media.state!=='playing')this.queue.queue=this.queue.queue.filter(n=>n.source!=='网易云音乐');
      if(this.musicBubbles&&media.status==='ready'&&media.state==='playing'&&key&&(key!==before||!wasPlaying))
        this.queue.push({id:'music:'+key+':'+Date.now(),source:'网易云音乐',title:'正在播放',body:media.title+(media.artist?' · '+media.artist:'')});
    } else if (m.kind === 'bridge') this.snapshot.bridgeStatus = m.status;
    else if (m.kind === 'codex') {
      const n = this.activity.event(m); if (n) this.queue.push(n);
    } else if (m.kind === 'notification') this.queue.push({ ...m, id: 'windows:' + m.id });
    else if (m.kind === 'permission') this.snapshot.notifications = ({ Allowed: '已启用', Denied: '系统未允许', Unspecified: '等待授权', Unavailable: '系统接口不可用' })[m.status] || m.status;
    else if (m.kind === 'error') this.snapshot.notifications = m.message || '读取失败';
    this.emit();
  }
  receiveProbe(source,data){
    if(!this.transferSources[source])return;
    if(!data){this.transferStatus[source]='检测超时或不可用';this.emit();return;}
    const available=Array.isArray(data.available)?data.available:[],tasks=Array.isArray(data.tasks)?data.tasks:[];const seen=new Set();
    for(const task of tasks){if(task.source!==source)continue;try{this.transfer.accept(task);seen.add(task.source+':'+task.id);}catch{}}
    for(const key of this.probeSeen)if(key.startsWith(source+':')&&!seen.has(key)){const id=key.slice(source.length+1);try{this.transfer.accept({source,id,state:'unknown'});}catch{}}
    this.probeSeen=new Set([...this.probeSeen].filter(key=>!key.startsWith(source+':')).concat([...seen]));
    this.transferStatus[source]=tasks.some(x=>x.source===source&&x.state==='active'&&Number.isFinite(x.percent))?'读取到公开进度':tasks.some(x=>x.source===source)?'检测到窗口，进度未知':available.includes(source)?'运行中，未提供可识别的进度':'未检测到窗口';this.emit();
  }
  setTransferSources(value){const previous=this.transferSources;this.transferSources={...value};for(const k of ['edge','chrome','thunder','baidu','install']){if(previous[k]===value[k])continue;this.transfer.setEnabled(k,value[k]===true);if(!value[k])this.transferStatus[k]='未启用';else this.transferStatus[k]=['edge','chrome'].includes(k)?'等待浏览器扩展':'等待检测';}this.transferProbe.configure(value);this.emit();}
  nextNotice() { return this.queue.next(Date.now(),this.focus.view().active); }
  setMusicEnabled(enabled){
    this.musicEnabled=enabled;clearTimeout(this.musicRestartTimer);
    if(!enabled){this.audioChild?.kill();this.audioChild=null;this.audioOutput(0);}
    if(!enabled){const child=this.musicChild;this.musicChild=null;child?.kill();this.queue.queue=this.queue.queue.filter(n=>n.source!=='网易云音乐');this.music.ingest({status:'disabled',reason:'音乐联动已关闭'});}
    else if(!this.stopped&&!this.musicChild&&this.bridge)this.musicChild=this.launch(['--media'],m=>this.receive(m));
    this.emit();
  }
  setMusicBubbles(enabled){this.musicBubbles=enabled;if(!enabled)this.queue.queue=this.queue.queue.filter(n=>n.source!=='网易云音乐');}
  startAudio(){if(this.audioChild||!this.bridge||!this.musicEnabled)return;this.audioChild=this.launch(['--audio-peak'],m=>{if(m.kind==='audioPeak')this.audioOutput(Number.isFinite(m.peak)?Math.max(0,Math.min(1,m.peak)):0);});}
  importLyrics(file,expectedTrack){
    const media=this.music.view();
    if(!expectedTrack||trackKey(media)!==expectedTrack)throw new Error('歌曲已切换，请重新选择歌词');
    const result=this.lyrics.import(media,file);this.emit();return result;
  }
  calibrateMusic(position){this.music.calibrate(position);this.emit();}
  async musicControl(action){
    const result=await this.controlMedia(action,this.musicEnabled);
    if(action!=='toggle'){this.music.clear();this.emit();}
    return result;
  }
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
    this.stopped = true;this.transferProbe.stop();
    clearInterval(this.refreshTimer); clearInterval(this.stateTimer);
    clearTimeout(this.restartTimer);
    clearTimeout(this.musicRestartTimer);
    this.codex.stop();
    for (const child of this.children) child.kill();
    this.children.clear();
  }
}
module.exports = { Companion };
