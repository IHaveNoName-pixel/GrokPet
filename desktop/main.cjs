'use strict';
const { app, BrowserWindow, Menu, Tray, screen, ipcMain, nativeImage, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { PetBrain, normalizeSettings, clampBounds, hitTest, COLORS, SHAPES } = require('./core.js');
const { SettingsStore } = require('./settings.cjs');
const { Companion } = require('./companion.cjs');

const root = path.join(__dirname, '..');
const smoke = process.argv.includes('--pet-smoke');
const dataDir = smoke ? path.join(root, 'artifacts', 'smoke-data') : app.isPackaged
  ? path.join(path.dirname(process.execPath), 'data') : path.join(root, '.runtime', 'user-data');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
app.setPath('sessionData', path.join(dataDir, 'session'));
app.setName('Blob Pet Study');

let win, tray, timer, store, settings, brain, companion, panelWindow;
let paused = false, suspended = false, quitting = false, menuOpen = false;
let drag = null, homeX = 0, roamX = 0, direction = 1, ignored = false;
let state = 'idle', lastTick = 0, lastStateSent = '', saveTimer;

function persist() {
  if (!store || !settings || !win || win.isDestroyed()) return;
  const b = win.getBounds();
  settings = normalizeSettings({ ...settings, x: b.x, y: b.y });
  try { store.save(settings); }
  catch (error) { console.error('Unable to save pet settings:', error.message); }
}

function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 500); }
function send(channel, value) { if (win && !win.isDestroyed()) win.webContents.send(channel, value); }
function publish() { send('pet:settings', { ...settings, paused }); }
function publishStats(value) {
  send('pet:stats', value);
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send('pet:stats', value);
}
async function showPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) { panelWindow.show(); panelWindow.focus(); return; }
  panelWindow = new BrowserWindow({ width: 440, height: 690, minWidth: 400, minHeight: 580, title: '桌宠状态 · Codex 与网络', autoHideMenuBar: true, backgroundColor: '#f5f6f0',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  panelWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  panelWindow.webContents.on('will-navigate', e => e.preventDefault());
  await panelWindow.loadFile(path.join(root, 'pet/panel.html'));
  if (companion) publishStats(companion.snapshot);
}
function setIgnored(value) {
  if (ignored === value) return;
  ignored = value;
  win.setIgnoreMouseEvents(value, { forward: true });
}

function keepVisible() {
  const b = win.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const next = clampBounds({ ...b, width: 360, height: 360 }, area);
  win.setBounds(next);
  homeX = roamX = next.x;
  queueSave();
}

function updateSettings(patch) {
  settings = normalizeSettings({ ...settings, ...patch });
  win.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  homeX = roamX = win.getBounds().x;
  publish(); rebuildTray(); persist();
}

function finishDrag() {
  if (!drag) return;
  drag = null;
  brain.interact('drag-end');
  homeX = roamX = win.getBounds().x;
  queueSave();
}

function setPaused(value) {
  finishDrag();
  paused = value;
  lastTick = Date.now();
  publish(); rebuildTray();
}

function setVisible(value) {
  finishDrag();
  if (value) { keepVisible(); win.showInactive(); }
  else win.hide();
  send('pet:visibility', value);
  rebuildTray();
}

function resetPosition() {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  win.setBounds(clampBounds({ x: area.x + area.width - 380, y: area.y + area.height - 380, width: 360, height: 360 }, area));
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
    { label: win.isVisible() ? '暂时隐藏' : '显示桌宠', click: () => setVisible(!win.isVisible()) },
    { label: paused ? '继续活动' : '暂停活动', click: () => setPaused(!paused) },
    { label: '叫醒它', click: () => { setPaused(false); brain.interact('wake'); setVisible(true); } },
    { type: 'separator' },
    { label: '桌面漫游', type: 'checkbox', checked: settings.roam, click: item => updateSettings({ roam: item.checked }) },
    { label: '保持置顶', type: 'checkbox', checked: settings.alwaysOnTop, click: item => updateSettings({ alwaysOnTop: item.checked }) },
    { label: '互动气泡', type: 'checkbox', checked: settings.bubbles, click: item => updateSettings({ bubbles: item.checked }) },
    { label: '大小', submenu: [96, 128, 160, 192].map(size => ({ label: `${size} px`, type: 'radio', checked: settings.size === size, click: () => updateSettings({ size }) })) },
    { label: '颜色', submenu: COLORS.map((color, i) => ({ label: colorNames[i], type: 'radio', checked: settings.color === color, click: () => updateSettings({ color }) })) },
    { label: '身形', submenu: SHAPES.map((shape, i) => ({ label: shapeNames[i], type: 'radio', checked: settings.shape === shape, click: () => updateSettings({ shape }) })) },
    { label: '回到屏幕角落', click: resetPosition },
    { type: 'separator' },
    { label: '退出桌宠', click: () => { quitting = true; app.quit(); } },
  ];
}

function rebuildTray() { if (tray) tray.setContextMenu(Menu.buildFromTemplate(menuTemplate())); }
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
    const next = clampBounds({ ...bounds, x: drag.bounds.x + cursor.x - drag.cursor.x, y: drag.bounds.y + cursor.y - drag.cursor.y }, area);
    win.setBounds(next);
    bounds = next;
  }
  if (!paused && !menuOpen) {
    const result = brain.tick(now, settings.roam);
    const activity = companion?.activity.state();
    const loadAnimation = companion?.snapshot.hardware.animation;
    const external = activity === 'alerting' ? activity : loadAnimation || activity;
    state = !brain.dragging && now >= brain.until && external ? external : result.state;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height * 0.60;
    const nearby = Math.hypot(cursor.x - cx, cursor.y - cy) < settings.size;
    if (result.roam && !activity && !loadAnimation && !drag && !nearby) {
      roamX += direction * 18 * dt;
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
    const notice = companion.nextNotice();
    if (notice) send('pet:notice', notice);
  }
  const local = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };
  const hit = hitTest(local, bounds, settings.size);
  setIgnored(!drag && !menuOpen && !hit);
  if (!paused) send('pet:gaze', local);
}

async function create() {
  store = new SettingsStore(path.join(dataDir, 'settings.json'));
  settings = store.load();
  brain = new PetBrain();
  win = new BrowserWindow({
    width: 360, height: 360, frame: false, transparent: true, backgroundColor: '#00000000',
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
  win.on('blur', finishDrag);
  win.on('close', event => { if (!quitting) { event.preventDefault(); setVisible(false); } });
  win.on('move', queueSave);

  ipcMain.handle('pet:ready', event => event.sender === win.webContents ? { ...settings, paused, state } : null);
  ipcMain.handle('pet:stats-read', event => [win?.webContents, panelWindow?.webContents].includes(event.sender) ? companion?.snapshot || null : null);
  ipcMain.handle('pet:companion-action', async (event, action) => {
    if (![win?.webContents, panelWindow?.webContents].includes(event.sender)) return { error: '非法窗口' };
    try {
      if (action === 'panel') await showPanel();
      else if (action === 'refresh') await companion?.refresh();
      else if (action === 'hooks') companion?.installHooks();
      else if (action === 'notifications-on') companion?.enableNotifications();
      else if (action === 'notifications-off') companion?.disableNotifications();
      else if (action === 'test-notice') companion?.queue.push({ id: 'test:' + Date.now(), source: '桌宠', title: '通知气泡已就绪', body: '这是一条本机测试消息。Windows 通知需要单独启用。' });
      else return { error: '未知操作' };
      return { ok: true };
    } catch (error) { return { error: error.message }; }
  });
  ipcMain.on('pet:action', (event, action) => {
    if (event.sender !== win.webContents || !['pet', 'drag-start', 'drag-end', 'menu'].includes(action)) return;
    if (action === 'menu') {
      finishDrag(); menuOpen = true; setIgnored(false);
      Menu.buildFromTemplate(menuTemplate()).popup({ window: win, callback: () => { menuOpen = false; } });
    } else if (action === 'drag-start' && !paused) {
      drag = { cursor: screen.getCursorScreenPoint(), bounds: win.getBounds() };
      brain.interact(action);
    } else if (action === 'drag-end') finishDrag();
    else if (!paused) brain.interact(action);
    tick();
  });

  tray = new Tray(nativeImage.createFromPath(path.join(root, 'assets', 'app-icon-256.png')).resize({ width: 24, height: 24 }));
  tray.setToolTip('软团桌宠 · 双击显示 / 右键设置');
  tray.on('double-click', () => setVisible(true));
  rebuildTray();
  powerMonitor.on('suspend', () => { suspended = true; stopTicker(); finishDrag(); send('pet:visibility', false); });
  powerMonitor.on('resume', () => { suspended = false; brain.interact('wake'); startTicker(); send('pet:visibility', win.isVisible()); });
  screen.on('display-removed', keepVisible);
  screen.on('display-metrics-changed', keepVisible);
  await win.loadFile(path.join(root, 'pet', 'index.html'));
  companion = new Companion(root, publishStats, smoke ? {channel:'smoke' + process.pid} : {});
  if (!smoke) companion.start();
  win.showInactive();
  startTicker();
  publish(); tick();
  if (!smoke && process.argv.includes('--panel')) await showPanel();
  if (smoke) {
    try {
      await require('./smoke.cjs')({ win, brain, store, updateSettings, tick, setPaused, setVisible, keepVisible, persist, dataDir, root, companion, showPanel, getPanel: () => panelWindow, stopTicker, startTicker, setIgnored });
      companion?.stop();
      quitting = true; app.exit(0);
    } catch (error) { companion?.stop(); console.error(error); quitting = true; app.exit(1); }
  }
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) setVisible(true); });
  app.whenReady().then(create).catch(error => { console.error(error); app.exit(1); });
}
app.on('before-quit', () => { quitting = true; companion?.stop(); clearInterval(timer); clearTimeout(saveTimer); persist(); });
app.on('window-all-closed', () => { if (quitting) app.quit(); });
