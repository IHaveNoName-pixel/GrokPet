'use strict';
const { app, BrowserWindow, Menu, Tray, screen, ipcMain, nativeImage, powerMonitor, dialog,shell,clipboard,safeStorage,globalShortcut } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { PetBrain, normalizeSettings, clampBounds, clampPetBounds, placeAssistant, hitTest, interactiveHit, COLORS, SHAPES,selectAnimation } = require('./core.js');
const { SettingsStore } = require('./settings.cjs');
const { Companion } = require('./companion.cjs');
const { createStartup } = require('./startup.cjs');

const root = path.join(__dirname, '..');
const smoke = process.argv.includes('--pet-smoke');
const dataDir = smoke ? path.join(root, 'artifacts', 'smoke-data') : app.isPackaged
  ? path.join(path.dirname(process.execPath), 'data') : path.join(root, '.runtime', 'user-data');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
app.setPath('sessionData', path.join(dataDir, 'session'));
app.setName('Blob Pet Study');

let win, tray, timer, store, settings, brain, companion, panelWindow;
let bubbleHoldUntil=0;
const clipboardHistory=new (require('./clipboard-history.cjs').ClipboardHistory)(()=>{const image=clipboard.readImage();if(!image.isEmpty()){const size=image.getSize();if(size.width*size.height>16777216)return null;return {kind:'image',bytes:image.toPNG(),...size};}return {kind:'text',text:clipboard.readText()};},value=>send('pet:clipboard-changed',value));
const clipboardPaste=new (require('./clipboard-paste.cjs').ClipboardPaste)({target:()=>companion?.pasteTarget,bridge:()=>companion?.bridge});
let vscodeBridge;
let startup,apiStore,life,lastLifeSaved=0;
const {VoiceStore,VoiceService}=require('./voice.cjs');
let voiceStore,voiceService,voicePhase=null,voiceUntil=0,voiceArmedUntil=0,voiceShortcut='';
function registerVoiceShortcut(key){if(voiceShortcut)globalShortcut.unregister(voiceShortcut);voiceShortcut='';if(!key)return '';try{if(!globalShortcut.register(key,()=>{if(suspended||!win?.isVisible())return;send('pet:voice-toggle');}))return '快捷键被占用，请更换';}catch{return '快捷键无法注册，请更换';}voiceShortcut=key;return '';}
function cancelVoice(){voiceArmedUntil=0;voicePhase=null;voiceUntil=0;voiceService?.cancel();send('pet:voice-cancel');}
const {PetLife}=require('./pet-life.cjs');
const {ApiStore,ApiClient}=require('./api-chat.cjs');
function selectChatBackend(target,mode){if((target.backend||'codex')===mode){target.snapshot.provider=mode==='api'?'API 模型':'Codex';return;}if(mode==='api')target.replaceClient(new ApiClient(apiStore.current()));else target.replaceClient(new (require('./codex-client.cjs').CodexClient)());target.backend=mode;target.snapshot.provider=mode==='api'?'API 模型':'Codex';}
let paused = false, suspended = false, quitting = false, menuOpen = false,petMenu=null;
let drag = null, homeX = 0, roamX = 0, direction = 1, ignored = false, dockExpansionShift = 0, dockExpanded = false;
let controlRegion=null,bubbleRegion=null,uiRegions=[];
let dockOriginY=null,dockOriginX=null,dockMotion=null,dockDestination='',dockMotionTarget=null;
let assistantWindow,assistant,petAssistant,assistantFocused=false,assistantPhaseUntil=0;
const replyArchive=new (require('./reply-archive.cjs').ReplyArchive)();
let referenceProject=null;
let action={state:null,until:0};
const {names:actionNames}=require('./action-catalog.cjs');
function playAction(value,duration=1800,preview=false){action={state:value,until:Date.now()+duration,preview};}
function quitAnimated(){if(smoke){app.quit();return;}quitting=true;send('pet:state','powering-down');setTimeout(()=>app.quit(),750);}
let commandExecutor,launchStore,systemCommands,radial,quickBusy=false;
let radialActive=false,radialSaved=null,radialRegions=[],radialCaptured=false,radialPreviousState=null,radialMoveTimer=null,radialMoveResolve=null,radialPreparePending=null,radialPrepareSequence=0;
async function localCommand(text){if(!commandExecutor)commandExecutor=require('./command-executor.cjs').createCommandExecutor({system:c=>systemCommands(c),focus:companion.focus,reminders:companion.reminders,setDock:(key,visible)=>updateSettings({dockItems:{...settings.dockItems,[key]:visible}}),setDisplay:patch=>updateSettings({dockItems:{...settings.dockItems,...patch.dockItems},dockLayout:patch.dockLayout??settings.dockLayout,hudMode:patch.hudMode??settings.hudMode,hudFontSize:patch.hudFontSize??settings.hudFontSize,hudItems:{...settings.hudItems,...patch.hudItems},summaryItems:{...settings.summaryItems,...patch.summaryItems},summaryOrder:patch.summaryOrder??settings.summaryOrder,summaryMax:patch.summaryMax??settings.summaryMax}),showPanel,mediaState:()=>companion.snapshot.media.state,musicControl:action=>companion.musicControl(action),emit:()=>companion.emit()});return commandExecutor(text,{source:typeof text==='string'?'chat':'control'});}
function assistantInfo(){return {api:apiStore?.public(),chat:assistant?.snapshot||null,project:referenceProject,searchEngine:settings.searchEngine,searchTemplate:settings.searchTemplate,actions:actionNames};}
function positionAssistant(){
 if(!assistantWindow||assistantWindow.isDestroyed()||!win||win.isDestroyed())return;
 const pet=win.getBounds(),area=screen.getDisplayMatching(pet).workArea;assistantWindow.setBounds(placeAssistant(pet,assistantWindow.getBounds(),area));
}
async function showAssistant(){
 if(assistantWindow&&!assistantWindow.isDestroyed()){positionAssistant();assistantWindow.show();assistantWindow.focus();return;}
 const bounds=win.getBounds();const area=screen.getDisplayMatching(bounds).workArea;
 const window=assistantWindow=new BrowserWindow({...placeAssistant(bounds,{width:500,height:700},area),minWidth:400,minHeight:500,title:'桌宠 · 问一问',autoHideMenuBar:true,icon:path.join(root,'assets/pet-icon.png'),titleBarStyle:'hidden',titleBarOverlay:{color:'#f7f9fc',symbolColor:'#44516a',height:36},backgroundColor:'#f6f7f9',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
 window.on('blur',()=>{assistantFocused=false;});window.on('closed',()=>{if(assistantWindow===window)assistantWindow=null;assistantFocused=false;assistant?.cancel('window').catch(()=>{});});
 await window.loadFile(path.join(root,'pet/assistant.html'));
}
let state = 'idle', lastTick = 0, lastStateSent = '', saveTimer;

function persist() {
  if (!store || !settings || !win || win.isDestroyed()) return;
  const b = win.getBounds();
  settings = normalizeSettings({ ...settings, wellbeing:life?.view()||settings.wellbeing, x: radialSaved?.x??dockOriginX??b.x, y: radialSaved?.y??dockOriginY??b.y });
  try { store.save(settings); }
  catch (error) { console.error('Unable to save pet settings:', error.message); }
}

function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 500); }
function send(channel, value) { if (win && !win.isDestroyed()) win.webContents.send(channel, value); }
function settingsSnapshot() { return { ...settings, paused, startup:startup?.read() || {registered:false,enabled:false} }; }
function publish() {
  const value = settingsSnapshot(); send('pet:settings', value);
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('pet:settings', value);
}
function setStartup(value) { startup.set(value); publish(); rebuildTray(); }
function trustedSender(event) {
  return [win,panelWindow,assistantWindow,radial?.get()].some(window=>window&&!window.isDestroyed()&&window.webContents===event.sender);
}
function publishStats(value) {
  if(life){value.life={...life.view(),name:settings.personality.name,sleeping:life.isSleeping()};if(Date.now()-lastLifeSaved>60000){lastLifeSaved=Date.now();persist();}}
  send('pet:stats', value);
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('pet:stats', value);
}
async function showPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) { panelWindow.show(); panelWindow.focus(); return; }
  panelWindow = new BrowserWindow({ width: 480, height: 760, minWidth: 400, minHeight: 580, title: '桌宠设置与状态', autoHideMenuBar: true, icon:path.join(root,'assets/pet-icon.png'), titleBarStyle:'hidden', titleBarOverlay:{color:'#f7f9fc',symbolColor:'#44516a',height:36}, backgroundColor: '#f6f7f9',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  panelWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  panelWindow.webContents.on('will-navigate', e => e.preventDefault());
  const createdPanel=panelWindow;
  createdPanel.once('closed',()=>{if(panelWindow===createdPanel)panelWindow=null;});
  await panelWindow.loadFile(path.join(root, 'pet/panel.html'));
  if (companion) publishStats(companion.snapshot);
  publish();
}
function setIgnored(value) {
  if (ignored === value) return;
  ignored = value;
  win.setIgnoreMouseEvents(value, { forward: true });
}

function keepVisible() {
  if(radialActive){const b=win.getBounds(),area=screen.getDisplayMatching(b).workArea;win.setBounds(require('./radial-window.cjs').radialBounds(radialSaved||b,area));return;}
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const next = clampPetBounds({ ...b, width: 360, height: b.height }, area,settings.size);
  win.setBounds(next);
  homeX = roamX = next.x;
  queueSave();
}

function updateSettings(patch) {
  if(!patch.timerScene&&settings.timerScene?.kind==='focus'&&(patch.focusMinutes!==undefined||patch.focusVisual!==undefined))patch={...patch,timerScene:{...settings.timerScene,minutes:patch.focusMinutes??settings.timerScene.minutes,visual:patch.focusVisual??settings.timerScene.visual}};
  const previousMusic=settings.musicEnabled;
  if(patch.personality)life?.configure(patch.personality);
  settings = normalizeSettings({ ...settings, ...patch });
  if(companion){if(companion.work.enabled!==settings.workEnabled)companion.setWorkEnabled(settings.workEnabled);companion.load.configure(settings.loadThresholds);companion.setTransferSources(settings.transferSources);companion.setMusicBubbles(settings.musicBubbles);if(previousMusic!==settings.musicEnabled)companion.setMusicEnabled(settings.musicEnabled);}
  win.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  homeX = roamX = win.getBounds().x;
  publish(); rebuildTray(); persist();
}

function finishDrag() {
  if (!drag) return;
  drag = null;
  brain.interact('drag-end');
  homeX = roamX = win.getBounds().x;
  positionAssistant();queueSave();
}

function setPaused(value) {
  finishDrag();
  paused = value;
  lastTick = Date.now();
  publish(); rebuildTray();
}

function setVisible(value) {
  finishDrag();
  if (value) { keepVisible(); win.showInactive();if(!smoke)playAction('spawning',1200); }
  else win.hide();
  send('pet:visibility', value);
  rebuildTray();
}

function resetPosition() {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  win.setBounds(clampBounds({ x: area.x + area.width - 380, y: area.y + area.height - 500, width: 360, height: 480 }, area));
  homeX = roamX = win.getBounds().x;
  setVisible(true);
  persist();
}

function menuTemplate() {
  const colorNames = ['墨黑', '栗棕', '莓红', '橙色', '金黄', '薄荷绿', '青色', '蓝色', '紫色', '粉色', '灰色'];
  const shapeNames = ['软团', '卵石', '圆方', '薄片', '楔形', '六边形', '云朵', '水滴'];
  return [
    { label: '软团 · 桌宠学习版', enabled: false },
    { label: 'Codex 与网络状态…', click: () => showPanel() },
    { label: '对话与服务设置…', click:()=>showAssistant() },
    { label: win.isVisible() ? '暂时隐藏' : '显示桌宠', click: () => setVisible(!win.isVisible()) },
    { label: paused ? '继续活动' : '暂停活动', click: () => setPaused(!paused) },
    { label: '叫醒它', click: () => { setPaused(false); brain.interact('wake'); setVisible(true); } },
    { type: 'separator' },
    { label: '桌面漫游', type: 'checkbox', checked: settings.roam, click: item => updateSettings({ roam: item.checked }) },
    { label: '保持置顶', type: 'checkbox', checked: settings.alwaysOnTop, click: item => updateSettings({ alwaysOnTop: item.checked }) },
    { label: '互动气泡', type: 'checkbox', checked: settings.bubbles, click: item => updateSettings({ bubbles: item.checked }) },
    { label: '状态信息显示', submenu: [
      {label:'鼠标移入时显示',type:'radio',checked:settings.hudMode==='hover',click:()=>updateSettings({hudMode:'hover'})},
      {label:'永久显示',type:'radio',checked:settings.hudMode==='always',click:()=>updateSettings({hudMode:'always'})},
      {label:'永久隐藏',type:'radio',checked:settings.hudMode==='hidden',click:()=>updateSettings({hudMode:'hidden'})},
      {type:'separator'}, {label:'自定义内容与字体…',click:()=>showPanel()},
    ]},
    { label: '开机启动', type:'checkbox', checked:startup.read().enabled, click:item=>{
      try {setStartup(item.checked);} catch(error) {dialog.showErrorBox('无法设置开机启动',error.message);rebuildTray();}
    } },
    { label: '大小', submenu: [96, 128, 160, 192].map(size => ({ label: `${size} px`, type: 'radio', checked: settings.size === size, click: () => updateSettings({ size }) })) },
    { label: '颜色', submenu: COLORS.map((color, i) => ({ label: colorNames[i], type: 'radio', checked: settings.color === color, click: () => updateSettings({ color }) })) },
    { label: '身形', submenu: SHAPES.map((shape, i) => ({ label: shapeNames[i], type: 'radio', checked: settings.shape === shape, click: () => updateSettings({ shape }) })) },
    { label: '回到屏幕角落', click: resetPosition },
    { type: 'separator' },
    { label: '退出桌宠', click:quitAnimated },
  ];
}

function openPetMenu(){if(menuOpen||!win||win.isDestroyed())return;finishDrag();menuOpen=true;setIgnored(false);win.focus();setImmediate(()=>{if(!win||win.isDestroyed()){menuOpen=false;return;}petMenu=Menu.buildFromTemplate(menuTemplate());petMenu.popup({window:win,callback:()=>{menuOpen=false;petMenu=null;}});});}
function rebuildTray() { if (tray) {tray.setToolTip(settings.personality.name+' · 双击显示 / 右键设置');tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));} }
function stopTicker() { clearInterval(timer); }
function startTicker() { stopTicker(); lastTick = Date.now(); timer = setInterval(tick, 50); }

function tick() {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;
  if (!win || win.isDestroyed() || !win.isVisible() || suspended) return;
  const cursor = screen.getCursorScreenPoint();
  let bounds = win.getBounds();
  if (drag) {
    const area = screen.getDisplayNearestPoint(cursor).workArea;
    const next = clampPetBounds({ ...bounds, x: drag.bounds.x + cursor.x - drag.cursor.x, y: drag.bounds.y + cursor.y - drag.cursor.y }, area,settings.size);
    win.setBounds(next);
    bounds = next;
  }
  if (!paused && !menuOpen) {
    const result = brain.tick(now, settings.roam&&settings.personality.activity!=='quiet'&&!life.isSleeping(now));
    life.resting=result.state==='sleeping';
    result.state=life.idle(result.state,now);
    result.roam=result.roam&&result.state==='idle';
    const codexActivity=companion?.activity.state();
    const activeAssistant=petAssistant?.snapshot.busy?petAssistant:assistant;const localPhase=activeAssistant&&(activeAssistant.snapshot.busy||now<assistantPhaseUntil)?activeAssistant.snapshot.phase:null;
    const transferAnimation=companion?.snapshot.transfers?.animation;
    const voiceActivity=now<voiceUntil?voicePhase:null;
    const activity=codexActivity==='alerting'?codexActivity:voiceActivity||(action.preview&&now<action.until&&action.state?action.state:codexActivity==='alerting'?codexActivity:(petAssistant?.snapshot.busy||assistant?.snapshot.busy)?localPhase:codexActivity||localPhase||((now<action.until)?action.state:null)||(assistantFocused?'listening':null)||transferAnimation||(companion?.snapshot.focus?.state==='running'?settings.focusVisual:companion?.snapshot.focus?.state==='paused'?'orbit':null));
    const loadAnimation = companion?.snapshot.hardware.animation;
    const musicAnimation=settings.musicEnabled&&companion?.snapshot.media.status==='ready'&&companion.snapshot.media.state==='playing'?'dictating':null;
    state=radialActive?'orbit':selectAnimation(result.state,{interaction:brain.dragging||now<brain.until,activity,music:musicAnimation,load:loadAnimation});
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + (radialActive?(bounds.width<=700||bounds.height<=600?70:bounds.height/2):216);
    const overControls=[controlRegion,bubbleRegion,...uiRegions].some(r=>r&&cursor.x>=bounds.x+r.x&&cursor.x<=bounds.x+r.x+r.width&&cursor.y>=bounds.y+r.y&&cursor.y<=bounds.y+r.y+r.height);
    const nearby = Math.hypot(cursor.x - cx, cursor.y - cy) < settings.size||overControls;
    if (!radialActive && result.roam && !dockExpanded && !dockMotion && !activity && !loadAnimation && !musicAnimation && !drag && !nearby) {
      roamX += direction * (settings.personality.activity==='lively'?26:18) * dt;
      const area = screen.getDisplayMatching(bounds).workArea;
      const left = Math.max(area.x, homeX - 100);
      const right = Math.min(area.x + area.width - bounds.width, homeX + 100);
      if (roamX <= left || roamX >= right) { direction *= -1; roamX = Math.max(left, Math.min(right, roamX)); }
      win.setPosition(Math.round(roamX), bounds.y);
      bounds = win.getBounds();
    }
  }
  if (state !== lastStateSent) {
    lastStateSent = state;
    send('pet:state', state);
  }
  if (!paused && !menuOpen && !drag && settings.bubbles && companion) {
    const notice = companion.nextNotice(petAssistant?.snapshot.busy||Date.now()<bubbleHoldUntil);
    if (notice) {send('pet:notice', notice);if(!smoke)playAction(notice.id?.startsWith('windows:')?'surprised':'notifying',1600);}
  }
  const local = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };
  const controls=controlRegion&&local.x>=controlRegion.x&&local.x<=controlRegion.x+controlRegion.width&&local.y>=controlRegion.y&&local.y<=controlRegion.y+controlRegion.height;
  const hit = interactiveHit(local, {...bounds,petY:radialActive?(bounds.width<=700||bounds.height<=600?70:bounds.height/2):216}, settings.size,[controlRegion,bubbleRegion,...radialRegions,...uiRegions]);
  setIgnored(!radialCaptured && !drag && !menuOpen && !hit);
  send('pet:gaze', local);
}

async function create() {
  store = new SettingsStore(path.join(dataDir, 'settings.json'));
  settings = store.load();apiStore=new ApiStore(path.join(dataDir,'api-profiles.json'),safeStorage);voiceStore=new VoiceStore(path.join(dataDir,'voice-settings.json'),safeStorage);voiceService=new VoiceService(voiceStore);
  startup = createStartup(app, process.execPath, root);
  brain = new PetBrain();life=new PetLife(settings.personality,settings.wellbeing);
  win = new BrowserWindow({
    width: 360, height: 480, frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop, show: false, title: '软团 · 桌宠学习版',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  if (settings.x !== null && settings.y !== null) win.setPosition(settings.x, settings.y);
  else resetPosition();
  keepVisible();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('context-menu',(_e,p)=>{const b=win.getBounds();if(hitTest({x:p.x,y:p.y},{...b,petY:radialActive?b.height/2:216},settings.size))openPetMenu();});
  win.on('blur', ()=>{finishDrag();assistantFocused=false;});
  win.webContents.on('render-process-gone',cancelVoice);
  win.on('hide',cancelVoice);
  win.on('close', event => { if (!quitting) { event.preventDefault(); setVisible(false); } });
  win.on('move', queueSave);

  ipcMain.handle('pet:personality-settings',(event,value)=>{if(!trustedSender(event)||!value||typeof value!=='object')return {error:'非法请求'};if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>24||!['quiet','normal','lively'].includes(value.activity)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.sleepAt)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.wakeAt)||value.scheduleEnabled&&value.sleepAt===value.wakeAt)return {error:'请填写 1–24 字名字、有效作息及活跃程度，入睡与起床时间不能相同'};updateSettings({personality:value});companion?.emit();return {ok:true};});
  ipcMain.handle('pet:ready', event => trustedSender(event) ? { ...settingsSnapshot(), state } : null);
  ipcMain.handle('pet:assistant-info',event=>trustedSender(event)?assistantInfo():null);
  const micAllowed=(wc,permission)=>wc===win.webContents&&permission==='media'&&Date.now()<voiceArmedUntil;
  win.webContents.session.setPermissionCheckHandler((wc,permission,_origin,details)=>micAllowed(wc,permission)&&details?.mediaType==='audio');
  win.webContents.session.setPermissionRequestHandler((wc,permission,callback,details)=>callback(micAllowed(wc,permission)&&Array.isArray(details?.mediaTypes)&&details.mediaTypes.length===1&&details.mediaTypes[0]==='audio'));
  ipcMain.on('pet:voice-phase',(event,value)=>{if(event.sender!==win.webContents)return;const phases={listening:'listening',recording:'dictating',transcribing:'loading',loading:'loading',speaking:'humming',review:null,error:null,idle:null};if(!Object.hasOwn(phases,value))return;voicePhase=phases[value];voiceUntil=Date.now()+90000;if(!['listening','recording'].includes(value))voiceArmedUntil=0;});
  ipcMain.handle('pet:voice',async(event,request)=>{if(!trustedSender(event)||!request)return {error:'非法语音请求'};try{
    if(request.type==='info')return {config:voiceStore.public(),shortcutActive:!!voiceShortcut};
    if(request.type==='save'){
      if(event.sender!==assistantWindow?.webContents)throw Error('请在问答设置中配置语音');
      const old=voiceStore.data;cancelVoice();const config=voiceStore.save(request.config||{}),warning=registerVoiceShortcut(config.shortcut);
      if(warning){fs.writeFileSync(voiceStore.file+'.tmp',JSON.stringify(old,null,2));fs.renameSync(voiceStore.file+'.tmp',voiceStore.file);voiceStore.data=old;registerVoiceShortcut(old.shortcut);throw Error(warning);}
      send('pet:voice-settings');return {config};
    }
    if(event.sender!==win.webContents)throw Error('请使用桌宠麦克风按钮');
    if(request.type==='cancel'){voiceService.cancel();voiceArmedUntil=0;voicePhase=null;return {ok:true};}
    if(request.type==='arm'){voiceStore.current('stt');if(suspended||!win.isVisible())throw Error('桌宠隐藏或休眠时不能录音');voiceArmedUntil=Date.now()+15000;return {ok:true,format:voiceStore.current('stt').backend==='windows'?'audio/wav':null};}
    if(request.type==='transcribe'){voiceArmedUntil=0;return {text:await voiceService.transcribe(request.bytes,request.mime)};}
    if(request.type==='speak')return {audio:await voiceService.speak(request.text),mime:voiceStore.current('tts').backend==='windows'?'audio/wav':'audio/mpeg'};
    throw Error('未知语音操作');
  }catch(e){return {error:e.message};}});
  ipcMain.on('pet:assistant-focus',(event,value)=>{if(event.sender===win.webContents||assistantWindow&&!assistantWindow.isDestroyed()&&event.sender===assistantWindow.webContents)assistantFocused=value===true;});
  ipcMain.handle('pet:assistant-action',async(event,request)=>{
    if(!trustedSender(event)||!request||typeof request!=='object')return {error:'非法请求'};
    try{
      if(request.type==='send'){
        if(['codex','api','local','chatgpt'].includes(request.mode)){const local=await localCommand(request.text);if(local)return local;if(request.mode==='local')throw new Error('未识别指令，请使用示例中的明确表达');}
        if(request.mode==='chatgpt'){
          const result=await require('./web-handoff.cjs').handoffChatGPT(request.text,{open:url=>shell.openExternal(url),copy:text=>clipboard.writeText(text)});
          playAction('sending',1000);send('pet:notice',{source:'ChatGPT',title:'问题已复制',body:'官网已打开，请粘贴后发送。'});return result;
        }
        if(request.mode==='search'){
          const url=require('./search.cjs').searchUrl(request.text,settings.searchEngine,settings.searchTemplate);playAction('searching',1800);await shell.openExternal(url);return {ok:true};
        }
        if(!['codex','api'].includes(request.mode))throw new Error('请选择问答后端');
        const isPet=event.sender===win.webContents;const mode=request.mode;const target=isPet?petAssistant:assistant;selectChatBackend(target,mode);await target.send(request.text,isPet||mode==='api'?null:referenceProject,isPet?'pet':'window');return {ok:true};
      }
      if(['copy-answer','show-answer','repeat-answer'].includes(request.type)){
        if(event.sender!==win.webContents)throw new Error('仅桌宠快捷入口可操作此回复');
        const text=replyArchive.get('pet',request.requestId);if(!text)throw new Error('这条回复已不可用');
        if(request.type==='copy-answer')clipboard.writeText(text);
        if(request.type==='show-answer'){await showAssistant();assistantWindow.webContents.send('pet:reply-view',{requestId:request.requestId,text});}
        return {ok:true,...(request.type==='repeat-answer'?{text}:{})};
      }
      if(request.type==='stop'){await (event.sender===win.webContents?petAssistant:assistant).cancel();return {ok:true};}
      if(request.type==='new'){if(assistant.snapshot.busy)throw new Error('请先停止当前问答');assistant.reset();return {ok:true};}
      if(request.type==='project'){
        if(assistant.snapshot.busy)throw new Error('请先停止当前回复');
        const selected=await dialog.showOpenDialog(assistantWindow||panelWindow||win,{properties:['openDirectory'],title:'选择只读参考项目（开启新会话）'});
        if(!selected.canceled){referenceProject=selected.filePaths[0];assistant.reset();}return {ok:true,info:assistantInfo()};
      }
      if(request.type==='clear-project'){if(assistant.snapshot.busy)throw new Error('请先停止当前回复');referenceProject=null;assistant.reset();return {ok:true,info:assistantInfo()};}
      if(['api-save','api-select','api-delete'].includes(request.type)){
        if(event.sender!==assistantWindow?.webContents&&event.sender!==panelWindow?.webContents)throw new Error('请在设置窗口操作 API 配置');
        if(assistant.snapshot.busy||petAssistant.snapshot.busy)throw new Error('请先停止正在进行的问答');
        const result=request.type==='api-save'?apiStore.save(request.profile):request.type==='api-select'?apiStore.select(request.id):apiStore.remove(request.id);
        for(const target of [assistant,petAssistant]){if(target.backend==='api'){target.replaceClient(new (require('./codex-client.cjs').CodexClient)());target.backend='codex';}}
        updateSettings({quickBackend:apiStore.data.quick&&apiStore.data.active?'api':'codex'});return {ok:true,api:result};
      }
      if(request.type==='search-settings'){
        require('./search.cjs').searchUrl('校验',request.engine,request.template);updateSettings({searchEngine:request.engine,searchTemplate:request.template});return {ok:true};
      }
      if(request.type==='preview'){
        if(request.state!==null&&!Object.hasOwn(actionNames,request.state))throw new Error('未知动作');
        playAction(request.state,3500,true);brain.deferIdle(3500);return {ok:true};
      }
      if(request.type==='inspect'){
        playAction('radar',1000);const good=companion.snapshot.bridgeStatus==='ready';
        setTimeout(()=>{playAction(good?'proud':'suspicious',1500);send('pet:notice',{source:'状态检查',title:good?'系统指标连接正常':'系统指标连接异常',body:'这是本机指标桥接状态，不代表互联网可达。'});},1000);return {ok:true};
      }
      throw new Error('未知操作');
    }catch(error){if(request.type==='send')playAction('confused');return {error:error.message};}
  });
  ipcMain.on('pet:dock-height',(event,height,expanded)=>{
    if(radialActive)return;
    if(event.sender!==win.webContents||!Number.isFinite(height)||height<480||height>900)return;
    if(drag)return;
    const b=win.getBounds(),area=screen.getDisplayMatching(b).workArea;
    if(expanded&&!dockExpanded){dockExpanded=true;dockOriginY=b.y;dockOriginX=b.x;}
    const restoring=dockExpanded&&expanded===false;
    const targetY=dockOriginY??(dockMotion&&dockDestination?JSON.parse(dockDestination).y:b.y);
    const targetX=dockOriginX??(dockMotion&&dockDestination?JSON.parse(dockDestination).x:b.x);
    const next=(expanded?clampBounds:((bounds,work)=>clampPetBounds(bounds,work,settings.size)))({...b,x:targetX,y:targetY,height:Math.min(Math.ceil(height),area.height)},area);
    if(restoring){dockExpanded=false;dockOriginY=null;dockOriginX=null;}
    const destination=JSON.stringify(next);if(destination===dockDestination&&(dockMotion||(b.x===next.x&&b.y===next.y&&b.height===next.height)))return;dockDestination=destination;
    dockMotionTarget=next;if(dockMotion)return;
    if(b.y===next.y&&b.x===next.x){if(b.height!==next.height)win.setBounds(next);return;}
    if(b.height!==next.height||b.y!==next.y||b.x!==next.x){
      const started=Date.now();
      win.setBounds({...b,height:Math.max(b.height,next.height)});
      dockMotion=setInterval(()=>{if(!win||win.isDestroyed()){clearInterval(dockMotion);dockMotion=null;return;}const next=dockMotionTarget;const t=Math.min(1,(Date.now()-started)/280),ease=t*t*(3-2*t);win.setBounds({...next,x:Math.round(b.x+(next.x-b.x)*ease),y:Math.round(b.y+(next.y-b.y)*ease),height:t<1?Math.max(b.height,next.height):next.height});if(t===1){clearInterval(dockMotion);dockMotion=null;homeX=roamX=next.x;queueSave();}},16);
    }
  });
  ipcMain.on('pet:ui-regions',(event,rects)=>{if(event.sender===win.webContents&&Array.isArray(rects))uiRegions=rects.filter(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0&&r.width<=5000&&r.height<=5000).slice(0,8);});
  ipcMain.on('pet:pointer-ready',(event)=>{if(event.sender===win.webContents){setIgnored(false);}});
  ipcMain.on('pet:control-region',(event,rect)=>{
    if(event.sender!==win.webContents)return;
    const bounds=win.getBounds();
    if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<=0||rect.height<=0){controlRegion=null;return;}
    controlRegion=Math.abs(rect.x)<=10000&&Math.abs(rect.y)<=10000&&rect.width<=5000&&rect.height<=5000?{...rect}:null;
  });
  ipcMain.on('pet:bubble-region',(event,rect)=>{
    if(event.sender!==win.webContents)return;
    const bounds=win.getBounds();
    if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<=0||rect.height<=0){bubbleRegion=null;return;}
    const left=Math.max(0,rect.x),top=Math.max(0,rect.y),right=Math.min(bounds.width,rect.x+rect.width),bottom=Math.min(bounds.height,rect.y+rect.height);
    bubbleRegion=right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;
  });
  ipcMain.handle('pet:music-control',async(event,action)=>{
    if(!trustedSender(event))return {error:'非法窗口'};
    try{if(!['previous','toggle','next'].includes(action))throw Error('无效的音乐操作');return await localCommand({type:action});}catch(error){playAction('confused');return {error:error.message};}
  });
  ipcMain.handle('pet:hud-settings',async(event,patch)=>{if(!trustedSender(event))return {error:'非法窗口'};try{return await localCommand({type:'display-settings',patch});}catch(error){return {error:error.message};}});
  require('./work/project-ipc.cjs').registerProjectIpc({ipcMain,authorized:event=>event.sender===panelWindow?.webContents,getMonitor:()=>companion.projects,emit:()=>companion.emit(),pick:async()=>{const result=await dialog.showOpenDialog(panelWindow,{title:'登记 Git 仓库根目录',properties:['openDirectory']});return result.canceled?null:result.filePaths[0];}});
  ipcMain.handle('pet:vscode',async(e,r)=>{if(!panelWindow||panelWindow.isDestroyed()||e.sender!==panelWindow.webContents||!r)return {error:'请在设置窗口管理 VS Code 联动'};try{if(r.type==='pair'){const file=await vscodeBridge.pairingFile();updateSettings({vscodeEnabled:true});shell.showItemInFolder(file);companion.snapshot.vscode=vscodeBridge.view();companion.emit();return {ok:true,file};}if(r.type==='disable'){vscodeBridge.revoke();updateSettings({vscodeEnabled:false});companion.snapshot.vscode=vscodeBridge.view();companion.emit();return {ok:true};}if(r.type==='extension'){const file=path.join(root,'vscode','GrokPet-work-bridge.vsix');if(!fs.existsSync(file))throw Error('请先构建 VS Code 扩展包');shell.showItemInFolder(file);return {ok:true};}throw Error('无效操作');}catch(error){return {error:error.message};}});
  ipcMain.handle('pet:work-settings',(event,value)=>{if(event.sender!==panelWindow?.webContents||typeof value!=='boolean')return {error:'请在设置窗口使用工作中心开关'};try{store.save(normalizeSettings({...settings,workEnabled:value}));updateSettings({workEnabled:value});return {ok:true};}catch(error){return {error:'工作设置保存失败：'+error.message};}});
  ipcMain.handle('pet:transfer-settings',(event,value)=>{if(!trustedSender(event)||!value||typeof value!=='object')return {error:'非法设置'};updateSettings({transferSources:{...settings.transferSources,...value}});return {ok:true};});
  ipcMain.handle('pet:startup', (event, value) => {
    if (!trustedSender(event) || typeof value!=='boolean') return {error:'非法设置'};
    try { setStartup(value); return {ok:true,startup:startup.read()}; } catch(error) {return {error:error.message};}
  });
  ipcMain.handle('pet:music-settings',(event,patch)=>{
    if(!trustedSender(event)||!patch||typeof patch!=='object')return {error:'非法设置'};
    const clean={};for(const key of ['musicEnabled','musicLyrics','musicBubbles'])if(typeof patch[key]==='boolean')clean[key]=patch[key];
    updateSettings(clean);return {ok:true};
  });
  ipcMain.handle('pet:music-calibrate',(event,value)=>{
    if(!trustedSender(event))return {error:'非法窗口'};
    try{if(value===null){companion.music.clear();companion.emit();}else companion.calibrateMusic(value);return {ok:true};}catch(error){return {error:error.message};}
  });
  ipcMain.handle('pet:scene-action',async(event,value)=>{if(!trustedSender(event)||!value||typeof value!=='object')return {error:'非法请求'};try{const {presets,cleanScene}=require('./scenes.cjs');if(value.type==='select'){const scene=[...presets,...settings.customScenes].find(x=>x.id===value.id);if(!scene)throw Error('场景不存在');updateSettings({timerScene:cleanScene({...scene,...(scene.id==='focus'?{minutes:settings.focusMinutes,visual:settings.focusVisual}:{})})});}
    else if(['save','custom'].includes(value.type)){const scene=cleanScene({...value.scene,id:value.type==='custom'?'custom-'+require('node:crypto').randomUUID():value.scene.id});let customScenes=settings.customScenes;if(value.type==='custom'){if(customScenes.length>=12)throw Error('最多保存 12 个自定义场景');customScenes=[...customScenes,scene];}else if(scene.id.startsWith('custom-'))customScenes=customScenes.map(x=>x.id===scene.id?scene:x);updateSettings({timerScene:scene,customScenes,...(scene.kind==='focus'?{focusMinutes:scene.minutes,focusVisual:scene.visual}:{})});}
    else if(value.type==='delete'){const id=settings.timerScene.id;if(!id.startsWith('custom-'))throw Error('预设场景不可删除');updateSettings({customScenes:settings.customScenes.filter(x=>x.id!==id),timerScene:cleanScene(presets[0])});}
    else if(value.type==='start'){const scene=settings.timerScene;if(companion.focus.view().active)throw Error('请先结束当前专注');if(scene.kind==='focus'){await localCommand({type:'focus-start',minutes:scene.minutes});updateSettings({focusMinutes:scene.minutes,focusVisual:scene.visual});}else{if(!scene.title.trim())throw Error('请先填写提醒或待办内容并保存');const {data:item}=await localCommand({type:scene.kind==='todo'?'todo-create':'reminder-create',title:scene.title,dueAt:Date.now()+scene.minutes*60000,options:{important:scene.important,repeat:scene.repeat}});updateSettings({sceneReminderId:item.id});}companion.emit();}
    else if(value.type==='stop'){const item=companion.reminders.items.find(x=>x.id===settings.sceneReminderId);if(item)await localCommand({type:'reminder-action',action:'remove',id:item.id});updateSettings({sceneReminderId:null});companion.emit();}else throw Error('未知场景操作');return {ok:true};}catch(error){return {error:error.message};}});
  ipcMain.handle('pet:focus-action',async (event,value)=>{if(!trustedSender(event)||!value||typeof value!=='object')return {error:'非法请求'};try{if(value.type==='settings'){updateSettings({focusMinutes:value.minutes??settings.focusMinutes,focusVisual:value.visual??settings.focusVisual,loadThresholds:{...settings.loadThresholds,...value.thresholds}});}else{await localCommand({type:'focus-'+value.type,minutes:settings.focusMinutes});}return {ok:true};}catch(error){return {error:error.message};}});
  ipcMain.on('pet:bubble-hold',(e,until)=>{if(e.sender===win.webContents&&Number.isFinite(until)&&until>=0&&until<=Date.now()+181000)bubbleHoldUntil=until;});
  ipcMain.on('pet:notice-result',(e,id,shown)=>{if(e.sender===win.webContents&&typeof id==='string'&&typeof shown==='boolean')companion.noticeResult(id,shown);});
  ipcMain.handle('pet:dock-layout',(e,value)=>{if(e.sender!==win.webContents||!['list','carousel'].includes(value))return {error:'无效卡片布局'};updateSettings({dockLayout:value});return {ok:true};});
  ipcMain.handle('pet:clipboard',async(e,r)=>{if(!win||win.isDestroyed()||e.sender!==win.webContents||!r||typeof r!=='object')return {error:'非法剪切板请求'};try{const restore=()=>{const item=clipboardHistory.get(r.id);if(item.kind==='text')clipboard.writeText(item.text);else clipboard.writeImage(nativeImage.createFromBuffer(item.bytes));clipboardHistory.restored(item.id);};if(r.type==='target')clipboardPaste.pin();else if(r.type==='paste'){const result=await clipboardPaste.paste(restore);return {...clipboardHistory.view(),...result};}else if(r.type==='enable')clipboardHistory.enable(r.value);else if(r.type==='clear')clipboardHistory.clear();else if(r.type==='remove')clipboardHistory.remove(r.id);else if(r.type==='restore')restore();else if(r.type!=='list')throw Error('无效操作');return clipboardHistory.view();}catch(error){return {error:error.message};}});
  ipcMain.handle('pet:reminder-action',async(event,value)=>{if(!trustedSender(event)||!value||typeof value!=='object')return {error:'非法请求'};try{if(value.type==='add')return await localCommand({type:value.at?'reminder-create':'todo-create',title:value.title,dueAt:value.at?new Date(value.at).getTime():null,options:{important:value.important,repeat:value.repeat}});return await localCommand({type:'reminder-action',action:value.type,id:value.id});}catch(error){return {error:error.message};}});
  const quickRun=async(action='status',value='')=>{if(!companion?.bridge)throw Error('缺少 Windows 桥接');const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)(companion.bridge,['--quick-control',action,'--value',String(value)],{windowsHide:true,timeout:10000,maxBuffer:16384});return JSON.parse(stdout.trim());};
  ipcMain.handle('pet:quick-choice',async(event,c)=>{if(!trustedSender(event)||!c||!['wifi-list','wifi-connect','bluetooth-list','power-list','power-plan','power-timeout'].includes(c.type))return {error:'非法选项'};try{if(quickBusy)throw Error('请等待当前操作完成');if(typeof c.value!=='undefined'&&typeof c.value!=='string')throw Error('无效参数');if((c.value||'').length>4096)throw Error('参数过长');quickBusy=true;try{const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)(companion.bridge,['--quick-choice',c.type,'--value',c.value||''],{windowsHide:true,timeout:15000,maxBuffer:196608});return JSON.parse(stdout.trim());}finally{quickBusy=false;}}catch(e){return {error:e.message};}});
  ipcMain.handle('pet:quick-status',async event=>{if(!trustedSender(event))return {error:'非法窗口'};const result=await Promise.allSettled([quickRun(),require('node:util').promisify(require('node:child_process').execFile)(companion.bridge,['--master-volume','get'],{windowsHide:true,timeout:5000,maxBuffer:8192})]);let volume={ok:false};if(result[1].status==='fulfilled'){try{volume=JSON.parse(result[1].value.stdout);}catch{}}return {...(result[0].status==='fulfilled'?result[0].value:{error:'系统快捷状态暂不可用'}),volume};});
  ipcMain.handle('pet:quick-action',async(event,c)=>{if(!trustedSender(event)||!c)return {error:'非法操作'};try{if(c.type==='open'){await radial.open(c.mode==='system'?'system':'quick');return {ok:true};}if(c.type==='close'){radial.close();return {ok:true};}if(c.type==='settings'){const urls={wifi:'ms-availablenetworks:',bluetooth:'ms-settings:bluetooth',brightness:'ms-settings:display',battery:'ms-settings:powersleep'};if(!urls[c.target])throw Error('无效设置');await shell.openExternal(urls[c.target]);return {ok:true};}if(!['wifi','bluetooth','brightness'].includes(c.type))throw Error('无效操作');if(c.type==='brightness'&&(!Number.isInteger(c.value)||c.value<0||c.value>100)||c.type!=='brightness'&&!['on','off'].includes(c.value))throw Error('无效参数');if(quickBusy)throw Error('请等待上一次操作完成');quickBusy=true;try{const r=await quickRun(c.type,c.value);if(!r.ok||c.type==='brightness'&&!r.brightness?.supported)throw Error(r.reason||r.brightness?.reason||'设备不支持该操作');return r;}finally{quickBusy=false;}}catch(e){return {error:e.message+'；可打开 Windows 设置继续操作'};}});
  ipcMain.on('pet:radial-commit',(event,id)=>{if(event.sender!==win.webContents||!radialActive||radialPreparePending?.id!==id||!radialPreparePending.bounds){event.returnValue=false;return;}win.setBounds(radialPreparePending.bounds);event.returnValue={x:radialPreparePending.bounds.x,y:radialPreparePending.bounds.y};});
  ipcMain.on('pet:radial-prepared',(event,value)=>{if(event.sender!==win.webContents||!radialPreparePending||value?.id!==radialPreparePending.id||!Number.isFinite(value.x)||!Number.isFinite(value.y)||Math.abs(value.x)>10000||Math.abs(value.y)>10000)return;radialPreparePending.finish({x:value.x,y:value.y,reducedMotion:value.reducedMotion===true});});
  ipcMain.on('pet:quick-capture',(event,value)=>radial?.capture(event.sender,value));
  ipcMain.on('pet:quick-regions',(event,value)=>radial?.regions(event.sender,value));
  ipcMain.handle('pet:system-command',async(event,c)=>{if(!trustedSender(event)||!c||!['launch','volume','system-status'].includes(c.type))return {error:'非法命令'};try{const result=await localCommand(c);send('pet:notice',{source:'本地操作',title:result.message});return result;}catch(e){send('pet:notice',{source:'本地操作',title:e.message});return {error:e.message};}});
  ipcMain.handle('pet:launch-targets',async(event,c)=>{if(!trustedSender(event))return {error:'非法窗口'};try{if(c?.type==='add'){if(!['app','folder'].includes(c.kind))throw Error('无效类型');const result=await dialog.showOpenDialog(panelWindow,{title:'选择快捷启动目标',properties:[c.kind==='app'?'openFile':'openDirectory'],...(c.kind==='app'?{filters:[{name:'Windows 应用',extensions:['exe','lnk']}]}:{})});if(result.canceled)return {items:launchStore.items};launchStore.add(c.name,result.filePaths[0],c.kind);}else if(c?.type==='remove')launchStore.remove(c.id);return {items:launchStore.items,error:launchStore.error};}catch(e){return {error:e.message};}});
  ipcMain.handle('pet:stats-read' , event => trustedSender(event) ? companion?.snapshot || null : null);
  ipcMain.handle('pet:companion-action', async (event, action) => {
    if (!trustedSender(event)) return { error: '非法窗口' };
    try {
      if (action === 'panel') await showPanel();
      else if(action==='assistant')await showAssistant();
      else if(action==='api-settings'){await showAssistant();assistantWindow.webContents.send('pet:open-api-settings');}
      else if (action === 'refresh') await companion?.refresh();
      else if(action==='browser-bridge-setup'){require('./browser-host.cjs').register({dataDir,bridge:companion.bridge});const error=await shell.openPath(path.join(root,'browser','extension'));if(error)throw new Error('桥接已注册，但无法打开扩展目录：'+error);}
      else if (action === 'hooks') companion?.installHooks();
      else if (action === 'notifications-on') companion?.enableNotifications();
      else if (action === 'notifications-off') companion?.disableNotifications();
      else if (action === 'test-notice') companion?.queue.push({ id: 'test:' + Date.now(), source: '桌宠', title: '通知气泡已就绪', body: '这是一条本机测试消息。Windows 通知需要单独启用。' });
      else if(action==='lyrics-import'){
        const current=companion.music.view();if(!current.trackKey)throw new Error('请先在网易云中选中一首歌曲');
        const chosen=await dialog.showOpenDialog(panelWindow||win,{title:'为当前歌曲选择本地LRC歌词',properties:['openFile'],filters:[{name:'LRC 歌词',extensions:['lrc']}]});
        if(!chosen.canceled&&chosen.filePaths[0])companion.importLyrics(chosen.filePaths[0],current.trackKey);
      }
      else return { error: '未知操作' };
      return { ok: true };
    } catch (error) { return { error: error.message }; }
  });
  ipcMain.on('pet:action', (event, action) => {
    if (event.sender !== win.webContents || !['pet', 'drag-start', 'drag-end', 'menu'].includes(action)) return;
    if (action === 'menu') {
      openPetMenu();
    } else if (action === 'drag-start' && !paused) {
      if(radialActive)return;
      clearInterval(dockMotion);dockMotion=null;dockExpanded=false;dockOriginY=null;dockOriginX=null;dockDestination='';
      drag = { cursor: screen.getCursorScreenPoint(), bounds: win.getBounds() };
      brain.interact(action);
    } else if (action === 'drag-end') finishDrag();
    else if (!paused) {brain.interact(action);if(action==='pet')life.pet();}
    tick();
  });

  tray = new Tray(nativeImage.createFromPath(path.join(root, 'assets', 'pet-icon.png')).resize({ width: 24, height: 24 }));
  tray.setToolTip(settings.personality.name+' · 双击显示 / 右键设置');
  tray.on('double-click', () => setVisible(true));
  rebuildTray();
  powerMonitor.on('suspend', () => { cancelVoice();suspended = true; stopTicker(); finishDrag(); send('pet:visibility', false); });
  powerMonitor.on('resume', () => { suspended = false; brain.interact('wake'); startTicker(); send('pet:visibility', win.isVisible()); });
  screen.on('display-removed', ()=>{keepVisible();positionAssistant();});
  screen.on('display-metrics-changed', ()=>{keepVisible();positionAssistant();});
  await win.loadFile(path.join(root, 'pet', 'index.html'));
  companion = new Companion(root, publishStats, {dataDir,workEnabled:settings.workEnabled,loadThresholds:settings.loadThresholds,audioPeak:value=>send('pet:audio-peak',value),musicEnabled:settings.musicEnabled,musicBubbles:settings.musicBubbles,transferSources:settings.transferSources,...(smoke?{channel:'smoke'+process.pid}:{})});
  vscodeBridge=new (require('./work/vscode-bridge.cjs').VscodeBridge)({channel:root,dataDir,projects:()=>companion.projects.store.view().items,publish:()=>{if(companion&&!companion.stopped){companion.snapshot.vscode=vscodeBridge.view();companion.emit();}}});
  if(settings.vscodeEnabled&&!smoke){try{await vscodeBridge.start();companion.snapshot.vscode=vscodeBridge.view();}catch(error){companion.snapshot.vscode={enabled:false,error:error.message,sessions:[]};}}
  radial={open:async(mode='quick')=>{if(radialActive){send('pet:radial-state',{open:true,mode,startAt:Date.now()});return;}const b=win.getBounds();radialSaved={x:dockOriginX??b.x,y:dockOriginY??b.y,width:360,height:480};clearInterval(dockMotion);dockMotion=null;dockExpanded=false;dockOriginY=null;dockOriginX=null;dockDestination='';radialPreviousState=state;radialActive=true;
 const area=screen.getDisplayMatching(b).workArea,next=require('./radial-window.cjs').radialBounds(b,area);
 const origin=await new Promise((resolve,reject)=>{const id=++radialPrepareSequence;const timer=setTimeout(()=>{radialPreparePending=null;radial.close();reject(Error('展开准备超时，请重试'));},2000);radialPreparePending={id,bounds:next,finish:value=>{clearTimeout(timer);radialPreparePending=null;resolve(value);}};send('pet:radial-prepare',{id,offset:{x:b.x-next.x,y:b.y-next.y}});});
 if(!radialActive)return;
 // Resize once; renderer compensates the old pet screen position before revealing the radial stage.
 win.focus();controlRegion=null;bubbleRegion=null;
 const animationId=++radialPrepareSequence;
 const animationReady=origin.reducedMotion?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(()=>{if(radialPreparePending?.id===animationId)radialPreparePending=null;resolve();},2000);radialPreparePending={id:animationId,finish:()=>{clearTimeout(timer);radialPreparePending=null;resolve();}};});
 send('pet:radial-state',{open:true,mode,animationId,origin,returnOrigin:{x:radialSaved.x+180-next.x,y:radialSaved.y+216-next.y}});send('pet:state','orbit');state='orbit';lastStateSent='orbit';setIgnored(false);
 if(origin.reducedMotion)return;
 await animationReady;if(!radialActive)return;
 await new Promise(resolve=>{radialMoveResolve=resolve;radialMoveTimer=setTimeout(()=>{radialMoveTimer=null;radialMoveResolve=null;resolve();},360);});
 },close:()=>{if(!radialActive)return;radialPreparePending?.finish(null);clearInterval(radialMoveTimer);radialMoveTimer=null;const done=radialMoveResolve;radialMoveResolve=null;done?.();radialActive=false;radialCaptured=false;radialRegions=[];const saved=radialSaved;radialSaved=null;if(saved&&!win.isDestroyed())win.setBounds(clampPetBounds(saved,screen.getDisplayMatching(saved).workArea,settings.size));send('pet:radial-state',false);state=radialPreviousState||'idle';radialPreviousState=null;send('pet:state',state);lastStateSent='';},get:()=>radialActive?win:null,capture:(sender,value)=>{if(sender===win.webContents)radialCaptured=value===true;},regions:(sender,value)=>{if(sender===win.webContents&&radialActive&&Array.isArray(value))radialRegions=value.filter(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))).slice(0,30);}};
  launchStore=new (require('./system-commands.cjs').LaunchStore)(path.join(dataDir,'launch-targets.json'));
  const runFile=require('node:util').promisify(require('node:child_process').execFile);
  systemCommands=require('./system-commands.cjs').createSystemCommands({store:launchStore,snapshot:()=>companion.snapshot,openApp:target=>path.extname(target).toLowerCase()==='.lnk'?shell.openPath(target).then(error=>{if(error)throw Error(error);}):new Promise((resolve,reject)=>{const child=require('node:child_process').spawn(target,[],{shell:false,detached:true,stdio:'ignore',windowsHide:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});}),openFolder:async target=>{const error=await shell.openPath(target);if(error)throw Error(error);},volume:async value=>{if(!companion.bridge)throw Error('缺少 Windows 桥接程序');const {stdout}=await runFile(companion.bridge,['--master-volume',value===undefined?'get':String(value)],{windowsHide:true,timeout:5000,maxBuffer:8192});const data=JSON.parse(stdout.trim());if(!data.ok)throw Error('音量操作失败');return data;}});
  const assistantDir=path.join(dataDir,'assistant-workspace');fs.mkdirSync(assistantDir,{recursive:true});
  const Assistant=require('./assistant.cjs').Assistant;
  petAssistant=new Assistant({fallbackDir:assistantDir,publish:value=>{assistantPhaseUntil=Date.now()+2500;replyArchive.capture('pet',value);send('pet:assistant-state',value);}});
  assistant=new Assistant({fallbackDir:assistantDir,publish:value=>{assistantPhaseUntil=Date.now()+2500;replyArchive.capture('window',value);if(assistantWindow&&!assistantWindow.isDestroyed())assistantWindow.webContents.send('pet:assistant-state',value);}});
  if (!smoke) companion.start();
  win.showInactive();if(!smoke)registerVoiceShortcut(voiceStore.public().shortcut);
  if(!smoke)playAction('spawning',1200);
  startTicker();
  publish(); tick();
  if (!smoke && process.argv.includes('--panel')) await showPanel();
  if (!smoke && process.argv.includes('--assistant')) await showAssistant();
  if (smoke) {
    try {
      await require(process.argv.includes('--pet-performance-smoke')?'./performance-smoke.cjs':process.argv.includes('--pet-display-smoke')?'./display-smoke.cjs':process.argv.includes('--pet-vscode-smoke')?'./vscode-smoke.cjs':process.argv.includes('--pet-dock-clipboard-smoke')?'./dock-clipboard-smoke.cjs':process.argv.includes('--pet-chat-history-smoke')?'./chat-history-smoke.cjs':process.argv.includes('--pet-git-projects-smoke')?'./git-projects-smoke.cjs':process.argv.includes('--pet-work-stage1-smoke')?'./work-stage1-smoke.cjs':process.argv.includes('--pet-radial-motion-smoke')?'./radial-motion-smoke.cjs':process.argv.includes('--pet-arc-smoke')?'./arc-smoke.cjs':process.argv.includes('--pet-ui-controls-smoke')?'./ui-controls-smoke.cjs':process.argv.includes('--pet-local-voice-smoke')?'./local-voice-smoke.cjs':process.argv.includes('--pet-voice-smoke')?'./voice-smoke.cjs':process.argv.includes('--pet-corner-motion-smoke')?'./corner-motion-smoke.cjs':process.argv.includes('--pet-system-orbit-smoke')?'./system-orbit-smoke.cjs':process.argv.includes('--pet-radial-smoke')?'./radial-smoke.cjs':process.argv.includes('--pet-m2-smoke')?'./m2-smoke.cjs':process.argv.includes('--pet-enhancement-smoke')?'./enhancement-smoke.cjs':process.argv.includes('--pet-scene-smoke')?'./scene-smoke.cjs':process.argv.includes('--pet-local-smoke')?'./local-smoke.cjs':process.argv.includes('--pet-api-smoke')?'./api-smoke.cjs':process.argv.includes('--pet-layout-smoke')?'./layout-smoke.cjs':process.argv.includes('--pet-assistant-smoke')?'./assistant-smoke.cjs':process.argv.includes('--pet-music-smoke')?'./music-smoke.cjs':'./smoke.cjs')({ isMenuOpen:()=>menuOpen,closeMenu:()=>petMenu?.closePopup(win),life,voiceStore,voiceService,win, brain, store, updateSettings, tick, setPaused, setVisible, keepVisible, persist, dataDir, root, companion,clipboardHistory,vscodeBridge, showPanel, getPanel: () => panelWindow,getRadial:()=>radial, stopTicker, startTicker, setIgnored,getControlRegion:()=>controlRegion,getUIRegions:()=>uiRegions,getRadialRegions:()=>radialRegions,getBubbleRegion:()=>bubbleRegion,showAssistant,getAssistantWindow:()=>assistantWindow,getAssistant:()=>assistant,getPetAssistant:()=>petAssistant });
      companion?.stop();
      quitting = true;console.log('Smoke exiting'); app.quit();
    } catch (error) { companion?.stop(); console.error(error); quitting = true; app.exit(1); }
  }
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) setVisible(true); });
  app.whenReady().then(create).catch(error => { console.error(error); app.exit(1); });
}
app.on('before-quit', () => { clipboardHistory.stop();vscodeBridge?.stop(); cancelVoice();globalShortcut.unregisterAll();quitting = true;radial?.close(); companion?.stop();assistant?.stop();petAssistant?.stop(); clearInterval(timer); clearTimeout(saveTimer); persist(); });
app.on('window-all-closed', () => { if (quitting) app.quit(); });
