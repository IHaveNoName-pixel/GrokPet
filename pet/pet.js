'use strict';
const hit = document.getElementById('pet-hit');
const bubble = document.getElementById('bubble');
let settings, bot, press, bubbleTimer, hidden = false;
let currentState = 'idle';
// Grace period after leaving the dock or collapsing a detail card (milliseconds).
const DOCK_HIDE_DELAY_MS=3000;
const dockHoverGrace=new HoverGrace(DOCK_HIDE_DELAY_MS);
window.holdDockHover=()=>{if(settings?.hudMode==='hover'){dockHoverGrace.hold();window.hudExpansionPointer=null;document.body.classList.add('hover');}};
let lastStats = null;
let bubbleUntil=0,bubbleType='notice',lastLyricKey=null,lastLyricTrack=null;
const toolbarHost=document.getElementById('cult-toolbar-host');toolbarHost.innerHTML=window.CULT_TOOLBAR_HTML;
const toolbarButtons=[...toolbarHost.querySelectorAll('button')];
for(const [index,label]of ['智能对话（使用所选后端额度）','浏览器搜索','打开问答与设置'].entries()){toolbarButtons[index].setAttribute('aria-label',label);toolbarButtons[index].title=label;}
toolbarButtons[2].id='ask-assistant';
const quickControlButton=document.createElement('button');quickControlButton.type='button';quickControlButton.className='radial-launch';quickControlButton.textContent='⌘';quickControlButton.title='快捷控制';quickControlButton.setAttribute('aria-label','展开环绕快捷控制');quickControlButton.onclick=()=>window.pet.quickAction({type:'open'});document.getElementById('dock-actions').append(quickControlButton);
let quickExpanded=false,quickBusy=false,bubblePending=false;
let quickRequestId=null,assistantBusy=false,assistantOwner=null,lastQuickAnswer='',lastQuickAnswerId=null;
const conversationHistory=new ConversationHistory();let historySignature='';
window.pet.onAssistant(value=>{
 conversationHistory.ingest(value);renderConversationHistory();
 assistantBusy=!!value.busy;assistantOwner=value.owner;
 const hasAnswer=lastQuickAnswerId!==null;document.getElementById('quick-speak').hidden=!hasAnswer;document.getElementById('quick-answer').hidden=!hasAnswer;document.getElementById('quick-copy').hidden=!hasAnswer;document.getElementById('quick-repeat').hidden=!lastQuickAnswer;
 if(value.busy&&value.owner==='pet'&&bubblePending)quickRequestId=value.requestId;
 document.getElementById('quick-send').disabled=quickBusy||(['codex','api'].includes(quickMode)&&assistantBusy);
 document.getElementById('quick-stop').hidden=!(assistantBusy&&assistantOwner==='pet');
 if(!bubblePending||value.busy||value.owner!=='pet'||value.requestId!==quickRequestId)return;
 const message=[...value.messages].reverse().find(m=>m.role==='assistant'&&m.requestId===quickRequestId);bubblePending=false;quickRequestId=null;const text=value.error||message?.text||'已停止或没有收到回复';if(message&&!value.error&&value.phase==='proud'){lastQuickAnswer=message.text;lastQuickAnswerId=message.requestId;document.getElementById('quick-speak').hidden=false;document.getElementById('quick-repeat').hidden=false;document.getElementById('quick-answer').hidden=false;document.getElementById('quick-copy').hidden=false;}say(text.length>130?text.slice(0,130)+'…（查看完整回答）':text,20000,'answer');if(message&&!value.error&&value.phase==='proud')window.voiceUI?.answer(message.text);
});

function renderConversationHistory(){
 const rows=conversationHistory.view(),signature=JSON.stringify(rows);if(signature===historySignature)return;historySignature=signature;
 const section=document.getElementById('chat-history'),list=document.getElementById('chat-history-list');section.hidden=!rows.length;const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<35,scroll=list.scrollTop;list.replaceChildren();
 document.getElementById('chat-history-toggle').textContent='对话记录 · '+rows.length+' 轮';
 for(const row of rows){const entry=document.createElement('article');entry.className='chat-turn';entry.dataset.requestId=row.id;const question=document.createElement('p');question.className='chat-question';question.textContent='你：'+row.question;entry.append(question);const answer=document.createElement('p');answer.className='chat-reply';answer.textContent=row.error||row.answer||({pending:'正在思考…',cancelled:'已停止，未收到完整回复'})[row.status]||'暂无回复';entry.append(answer);if(row.status==='complete'){const button=document.createElement('button');button.type='button';button.textContent='显示此回复';button.addEventListener('click',()=>{lastQuickAnswer=row.answer;lastQuickAnswerId=row.id;for(const id of ['quick-speak','quick-repeat','quick-answer','quick-copy'])document.getElementById(id).hidden=false;say(row.answer.length>130?row.answer.slice(0,130)+'…（查看完整回答）':row.answer,20000,'answer');});entry.append(button);}list.append(entry);}
 list.scrollTop=bottom?list.scrollHeight:scroll;window.systemCard?.fit();updateMusicControls();
}
document.getElementById('chat-history-toggle').addEventListener('click',event=>{const button=event.currentTarget,list=document.getElementById('chat-history-list'),open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));list.hidden=!open;window.holdDockHover?.();window.systemCard?.fit();updateMusicControls();});
new ResizeObserver(()=>{window.systemCard?.fit();updateMusicControls();}).observe(document.getElementById('chat-history'));

document.getElementById('info-dock').prepend(document.getElementById('dock-actions'));
const quickForm=document.getElementById('quick-form'),quickInput=document.getElementById('quick-input');let quickMode='codex';
function quickOpen(mode){quickMode=mode;document.getElementById('quick-mode').value=mode;quickExpanded=true;document.body.classList.add('quick-open');quickForm.hidden=false;updateMusicControls();window.dispatchEvent(new Event('dock-reveal-composer'));quickInput.focus();}
function quickClose(){quickExpanded=false;quickInput.blur();document.body.classList.remove('quick-open');window.holdDockHover?.();updateMusicControls();}
document.getElementById('quick-mode').addEventListener('change',()=>{modeUserSelected=true;quickMode=document.getElementById('quick-mode').value;document.getElementById('quick-send').disabled=quickBusy||(['codex','api'].includes(quickMode)&&assistantBusy);quickInput.placeholder=quickMode==='search'?'输入搜索内容…':quickMode==='local'?'例如：十分钟后提醒我喝水…':'聊点什么，或告诉我想做的事…';});
document.getElementById('quick-more').onclick=()=>window.pet.companion('api-settings');
let modeInitialized=false,modeUserSelected=false;
function syncChatInfo(){window.pet.assistantInfo().then(info=>{const profile=info.api?.profiles?.find(p=>p.id===info.api.active);document.querySelector('#quick-mode option[value=api]').textContent='智能对话 · '+(profile?.model||'API');document.querySelector('#quick-mode option[value=api]').disabled=!profile;if(!modeInitialized||!modeUserSelected){quickMode=settings?.quickBackend==='api'?'api':'codex';document.getElementById('quick-mode').value=quickMode;modeInitialized=true;}}).catch(()=>{});}
document.getElementById('quick-repeat').addEventListener('click',async()=>{const r=await window.pet.assistantAction({type:'repeat-answer',requestId:lastQuickAnswerId});const text=r.error||r.text;say(text.length>130?text.slice(0,130)+'…（查看完整回答）':text,20000,'answer');});
document.getElementById('quick-answer').addEventListener('click',async()=>{const r=await window.pet.assistantAction({type:'show-answer',requestId:lastQuickAnswerId});if(r.error)say(r.error,4000);});
document.getElementById('quick-copy').addEventListener('click',async()=>{const r=await window.pet.assistantAction({type:'copy-answer',requestId:lastQuickAnswerId});say(r.error||'回答已复制',3000,'feedback');});
document.getElementById('quick-stop').addEventListener('click',async()=>{await window.pet.assistantAction({type:'stop'});});
toolbarButtons[0].addEventListener('click',()=>quickOpen(settings?.quickBackend==='api'?'api':'codex'));toolbarButtons[1].addEventListener('click',()=>quickOpen('search'));
document.getElementById('quick-close').addEventListener('click',()=>quickClose());
quickInput.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();window.voiceUI?.cancel();quickClose();}else if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!document.getElementById('quick-send').disabled)quickForm.requestSubmit();}});
quickInput.addEventListener('focus',()=>window.pet.assistantFocus(true));quickInput.addEventListener('blur',()=>{window.pet.assistantFocus(false);setTimeout(()=>{if(!quickForm.contains(document.activeElement))quickClose();},0);});
quickForm.addEventListener('submit',async event=>{event.preventDefault();const text=quickInput.value,mode=quickMode;if(quickBusy||['recording','listening','transcribing'].includes(window.voiceUI?.controller.state)||['codex','api'].includes(mode)&&assistantBusy||!text.trim())return;window.voiceUI?.cancel();quickBusy=true;document.getElementById('quick-send').disabled=true;try{if(['codex','api'].includes(mode)){bubblePending=true;say('正在思考…',180000,'thinking');}const result=await window.pet.assistantAction({type:'send',mode,text});if(result.error)throw new Error(result.error);if(result.local){bubblePending=false;say(result.message,6500,'answer');window.voiceUI?.answer(result.message);}if(quickInput.value===text&&quickMode===mode)quickInput.value='';if(mode==='search')say('已打开搜索结果',6500);}catch(error){bubblePending=false;say(error.message,5000,'feedback');}finally{quickBusy=false;document.getElementById('quick-send').disabled=['codex','api'].includes(quickMode)&&assistantBusy;}});

function say(text, duration = 2600, type='notice') {
  if(!canReplaceBubble({type:bubbleType,until:bubbleUntil},type,bubblePending||assistantBusy))return false;
  clearTimeout(bubbleTimer);
  if (!settings?.bubbles || hidden) return;
  bubble.textContent = text;
  bubble.scrollTop=0;bubbleType=type;bubbleUntil=Date.now()+duration;
  bubble.classList.add('show');
  document.body.classList.add('has-bubble');
  window.pet.bubbleHold(['answer','thinking'].includes(type)?bubbleUntil:0);
  scheduleBubbleHide(duration);return true;
}

function scheduleBubbleHide(delay){clearTimeout(bubbleTimer);bubbleTimer=setTimeout(()=>{bubble.classList.remove('show');document.body.classList.remove('has-bubble');window.pet.bubbleHold(0);},delay);}
bubble.addEventListener('mouseenter',()=>{if(bubble.classList.contains('show'))clearTimeout(bubbleTimer);});
bubble.addEventListener('mouseleave',()=>{if(bubble.classList.contains('show'))scheduleBubbleHide(Math.max(3000,bubbleUntil-Date.now()));});
let lastBubbleRegion='';
function updateBubbleRegion(){
 const visible=!hidden&&!!settings?.bubbles&&bubble.classList.contains('show')&&!document.body.classList.contains('dragging');
 const r=bubble.getBoundingClientRect();const rect=visible?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
 const key=JSON.stringify(rect);if(key!==lastBubbleRegion){lastBubbleRegion=key;window.pet.bubbleRegion(rect);}
}
new MutationObserver(updateBubbleRegion).observe(bubble,{attributes:true,attributeFilter:['class']});
new ResizeObserver(updateBubbleRegion).observe(bubble);window.addEventListener('resize',updateBubbleRegion);

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
  syncChatInfo();
  if(value.hudMode!=='hover')dockHoverGrace.reset();
  hit.setAttribute('aria-label',(value.personality?.name||'软团')+'，抚摸或拖动，右键打开设置');
  toolbarButtons[0].title=value.quickBackend==='api'?'智能对话（API 服务）':'智能对话（使用所选后端额度）';toolbarButtons[0].setAttribute('aria-label',toolbarButtons[0].title);
  syncScenes(value);document.getElementById('quick-focus-minutes').value=value.timerScene.minutes;document.getElementById('quick-focus-visual').value=value.focusVisual;for(const k of ['cpu','memory','gpu','seconds'])document.getElementById('quick-load-'+k).value=value.loadThresholds[k];

  toolbarHost.hidden=true;quickForm.hidden=false;quickControlButton.hidden=false;window.DockUI?.settings(value);
  if(value.hudMode==='hidden'&&quickExpanded)quickClose(true);
  document.documentElement.style.setProperty('--pet-size', `${value.size}px`);
  document.documentElement.style.setProperty('--hud-font', `${value.hudFontSize}px`);
  document.body.dataset.hudMode = value.hudMode;
  if (bot) { bot.setShape(value.shape); bot.setColor(value.color, 'light'); }
  if (!value.bubbles) {bubble.classList.remove('show');document.body.classList.remove('has-bubble');}
  if((!value.musicEnabled||!value.musicBubbles)&&bubbleType==='music'){clearTimeout(bubbleTimer);bubbleUntil=0;bubble.classList.remove('show');document.body.classList.remove('has-bubble');}
  if (lastStats) stats(lastStats);
  updatePause();
  updateMusicEffect();
  updateMusicControls();
}

function applyState(state) {
  if (!bot || state === currentState) return;
  currentState = state;
  bot.setState(state);
  updateMusicEffect();
  if (state === 'waking') say('醒啦，陪你一会儿',2600,'idle');
  if (state === 'sleeping') say('我在这里打个盹…',2600,'idle');
  if (state === 'drowsy') say('有一点点困了',2600,'idle');
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
let musicControlBusy=false,lastControlRegion='',lastDockVisible=null,lastMediaStats,lastMediaSettings,lastMediaBusy,lastDockRect=null;
function updateMusicControls(layout=true){
  if(document.body.classList.contains('radial-open')){if(lastControlRegion!=='radial'){lastControlRegion='radial';window.pet.controlRegion(null);}return;}
  const actions=document.getElementById('dock-actions'),actionsHidden=toolbarHost.hidden&&quickForm.hidden;if(actions.hidden!==actionsHidden)actions.hidden=actionsHidden;
  if(lastMediaStats!==lastStats||lastMediaSettings!==settings||lastMediaBusy!==musicControlBusy){
    lastMediaStats=lastStats;lastMediaSettings=settings;lastMediaBusy=musicControlBusy;
    const controls=document.getElementById('music-controls'),hidden=!(settings?.dockItems?.music!==false&&settings?.hudItems?.music&&availableHud(lastStats,settings).music);if(controls.hidden!==hidden)controls.hidden=hidden;
    const label=lastStats?.media?.state==='playing'?'暂停':'播放',toggle=document.getElementById('music-toggle');
    if(toggle.getAttribute('aria-label')!==label){toggle.title=label;toggle.setAttribute('aria-label',label);if(window.ArcUI)window.ArcUI.setMediaIcon(toggle);else toggle.textContent=label==='暂停'?'⏸':'▶';}
    controls.querySelectorAll('button').forEach(button=>{if(button.disabled!==musicControlBusy)button.disabled=musicControlBusy;});
  }
  const visible=!document.body.classList.contains('dragging')&&(settings?.hudMode==='always'||settings?.hudMode==='hover'&&(document.body.classList.contains('hover')||quickExpanded||document.body.classList.contains('clipboard-open')));
  const changed=lastDockVisible!==visible;if(changed){lastDockVisible=visible;window.systemCard.fit();}
  if(visible&&(layout||changed||!lastDockRect)){const r=document.getElementById('info-dock').getBoundingClientRect();lastDockRect={x:r.x,y:r.y,width:r.width,height:r.height};}
  const rect=visible?lastDockRect:null,key=JSON.stringify(rect);if(key!==lastControlRegion){lastControlRegion=key;window.pet.controlRegion(rect);}
}
for(const button of document.querySelectorAll('[data-music]'))button.addEventListener('click',async()=>{
  musicControlBusy=true;updateMusicControls();
  try{const result=await window.pet.musicControl(button.dataset.music);if(result.error)say(result.error,5000);}
  catch(error){say('音乐控制失败：'+error.message,5000);}
  finally{musicControlBusy=false;updateMusicControls();}
});
function updateMusicEffect(){
  const active=settings?.musicEnabled&&!settings.paused&&lastStats?.media?.state==='playing'&&['humming','dictating'].includes(currentState)&&!lastStats?.activity;
  document.body.classList.toggle('music-active',!!active);
}
function renderLyric(m){
  const close=()=>{if(bubbleType==='lyric'){clearTimeout(bubbleTimer);bubbleUntil=0;bubble.classList.remove('show');document.body.classList.remove('has-bubble');}lastLyricKey=null;};
  if(m?.trackKey!==lastLyricTrack){close();lastLyricTrack=m?.trackKey;}
  if(lastStats?.focus?.active||!settings?.musicEnabled||!settings.musicLyrics||!settings.bubbles||m?.state!=='playing'||!m.lyric?.text){close();return;}
  const key=m.trackKey+':'+m.lyric.at+':'+m.lyric.text;
  if(key!==lastLyricKey&&(bubbleType==='lyric'||Date.now()>=bubbleUntil)){
    say('♪ '+m.lyric.text,10000,'lyric');lastLyricKey=key;
  }
}
function stats(value) {
  if (!value) return;
  const enteringFocus=value.focus?.active&&!lastStats?.focus?.active;
  if(enteringFocus&&['lyric','music','notice'].includes(bubbleType)){clearTimeout(bubbleTimer);bubbleUntil=0;bubble.classList.remove('show');document.body.classList.remove('has-bubble');}
  lastStats = value;
  window.DockUI?.stats(value);
  const reminders=value.reminders?.items?.filter(x=>x.status!=='done')||[];const reminderButton=document.getElementById('reminder-shortcut');document.getElementById('reminder-card').hidden=!reminders.length;const due=reminders.filter(x=>x.status==='due').sort((a,b)=>a.dueAt-b.dueAt);const confirm=document.getElementById('reminder-confirm');confirm.hidden=!due.length;confirm.dataset.id=due[0]?.id||'';confirm.title=due.length?'确认：'+due[0].title:'';reminderButton.textContent='提醒待办 · '+reminders.length+' 项'+(reminders.some(x=>x.status==='due')?' · 有到期提醒':'');
  const f=value.focus;document.getElementById('focus-card').hidden=settings?.dockItems?.focus===false;document.getElementById('load-card').hidden=settings?.dockItems?.load===false;
  if(f){const item=value.reminders?.items?.find(x=>x.id===settings?.sceneReminderId&&x.status==='pending'&&x.dueAt!==null),active=f.active||!!item;const sec=Math.max(0,Math.ceil((f.active?f.remainingMs:item?item.dueAt-Date.now():0)/1000));document.getElementById('focus-label').textContent=(f.active?(f.state==='paused'?'专注暂停':'专注中'):item?item.title:settings?.timerScene?.name||'场景与提醒');const time=active?sec:Math.round((settings?.timerScene?.minutes||25)*60),hours=Math.floor(time/3600);document.getElementById('focus-clock').textContent=(hours?String(hours).padStart(2,'0')+':':'')+String(Math.floor(time/60)%60).padStart(2,'0')+':'+String(time%60).padStart(2,'0');const timer=document.getElementById('focus-timer');timer.dataset.running=String(f.state==='running'||!!item);timer.dataset.state=f.state;timer.hidden=settings?.timerScene?.kind==='todo';for(const button of document.querySelectorAll('[data-focus-quick]'))button.hidden=button.dataset.focusQuick==='start'?active:button.dataset.focusQuick==='pause'?f.state!=='running':button.dataset.focusQuick==='resume'?f.state!=='paused':!active;document.querySelector('[data-focus-quick=start]').textContent=settings?.timerScene?.kind==='todo'?'添加':'开始';}

  document.getElementById('quick-load-status').textContent=({high:'持续高负载',critical:'极高负载',normal:'正常',unknown:'等待指标'})[value.hardware?.level]||'';
  if(bot?.fx)bot.fx.externalProgress=value.transfers?.tasks?.find(t=>t.state==='active')?.progress??(value.focus?.active?value.focus.progress:null);
  const selected = settings?.hudItems || {codex:true,network:true,vpn:true,cpu:true,memory:true,gpu:true};
  const availability=availableHud(value,settings);const items=Object.fromEntries(Object.keys(selected).map(key=>[key,selected[key]&&availability[key]]));
  document.getElementById('telemetry').hidden = !Object.values(items).some(Boolean);
  const quota = value.quota;
  const windows = (quota.buckets.find(b => b.id === 'codex') || quota.buckets[0])?.windows || [];
  document.getElementById('quota-line').textContent = quota.status === 'ready'
    ? 'Codex 剩余 · ' + (windows.length ? windows.map(w => (w.minutes === 300 ? '5h' : w.minutes === 10080 ? '周' : (w.minutes || '?') + 'm') + ' ' + (w.remaining === null ? '未知' : w.remaining + '%')).join(' / ') : '无额度数据')
    : quota.status === 'error' ? 'Codex 暂不可用 · 右键查看' : 'Codex 连接中…';
  const n = value.network;
  document.getElementById('quota-line').hidden = !items.codex;
  const netParts = [];
  if (items.network) netParts.push(n.status==='ready' ? '↓ ' + speed(n.download) + '  ↑ ' + speed(n.upload) : '网速不可用');
  if (items.vpn) netParts.push(n.status==='ready' ? (n.tunnels.length ? 'TUN 开' : n.proxyEnabled ? '代理开' : '代理关') : 'VPN 未知');
  document.getElementById('network-line').textContent = netParts.join(' · ');
  document.getElementById('network-line').hidden = !netParts.length;
  const h = value.hardware || {};
  const percent = n => typeof n === 'number' ? Math.round(n) + '%' : '—';
  document.getElementById('hardware-line').textContent = ['cpu','memory','gpu'].filter(k=>items[k]).map(k=>({cpu:'CPU',memory:'内存',gpu:'GPU'})[k]+' '+percent(h[k])).join(' · ');
  document.getElementById('hardware-line').hidden = !['cpu','memory','gpu'].some(k=>items[k]);
  const transfer=(value.transfers?.tasks||[]).find(t=>t.state==='active'||t.state==='paused'||t.state==='unknown');const indicator=document.getElementById('transfer-indicator');indicator.hidden=!transfer||settings?.dockItems?.transfer===false;if(transfer){const progress=document.getElementById('transfer-progress');document.getElementById('transfer-title').textContent=({edge:'Edge',chrome:'Chrome',thunder:'迅雷',baidu:'百度网盘',install:'安装'})[transfer.source]+' · '+(transfer.name||'进行中')+(transfer.state==='paused'?' · 已暂停':transfer.state==='unknown'?' · 状态未知':transfer.progress===null?' · 进度未知':' · '+transfer.progress+'%');progress.hidden=transfer.state==='unknown';if(transfer.progress===null)progress.removeAttribute('value');else progress.value=transfer.progress;}
  const m=value.media||{};
  document.getElementById('music-line').hidden=!items.music;
  const clock=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  document.getElementById('music-line').textContent=m.status==='ready'?'♪ '+m.title+(m.positionMs===null||m.positionMs===undefined?'':(' · '+clock(m.positionMs)+(m.timelineSource==='manual'?' 手动':''))):m.reason||'网易云未连接';
  document.getElementById('music-artist').textContent=m.artist||'';
  window.systemCard.render(value,settings);
  updateMusicEffect();renderLyric(m);updateMusicControls();
}
hit.addEventListener('dblclick', () => window.pet.companion('panel'));
document.getElementById('ask-assistant').addEventListener('click',()=>window.pet.companion('assistant'));
window.pet.onStats(stats);
window.pet.onAudioPeak(value=>{if(bot?.fx){bot.fx.audioPeak=lastStats?.media?.state==='playing'?value:0;}});
window.pet.stats().then(stats);
window.pet.onNotice(notice => {
 const music=notice.source==='网易云音乐';if(music&&(!settings?.musicEnabled||!settings.musicBubbles)){window.pet.noticeResult(notice.id,true);return;}
 const shown=say(notice.source+' · '+notice.title+(notice.body?'\n'+notice.body:''),7500,notice.priority==='urgent'?'urgent':music?'music':'notice')===true;
 if(shown&&notice.reminderId){const actions=document.createElement('div');actions.className='bubble-actions';for(const [type,label]of [['complete','完成'],['snooze','5分钟后'],['view','查看']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{if(type==='view'){await window.pet.companion('panel');return;}const r=await window.pet.reminderAction({type,id:notice.reminderId});say(r.error||'提醒已更新',4000,'feedback');}finally{b.disabled=false;}};actions.append(b);}bubble.append(actions);updateBubbleRegion();}
 window.pet.noticeResult(notice.id,shown);
});

hit.addEventListener('pointerdown', event => {
  window.pet.pointerReady();
  if (event.button !== 0) return;
  press = { id: event.pointerId, x: event.screenX, y: event.screenY, dragging: false };
  hit.setPointerCapture(event.pointerId);
});
hit.addEventListener('pointermove', event => {
  if (!press || settings?.paused || press.dragging) return;
  if (Math.hypot(event.screenX - press.x, event.screenY - press.y) > 5) {
    press.dragging = true;
    hit.classList.add('dragging'); document.body.classList.add('dragging');updateBubbleRegion();
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
  hit.classList.remove('dragging'); document.body.classList.remove('dragging');updateBubbleRegion();
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
window.pet.onVisibility(value => { hidden = !value;if(hidden)dockHoverGrace.reset(); if (hidden) bubble.classList.remove('show'); updateBubbleRegion();updatePause(); });
function handleGaze(point) {
  if (!bot) return;
  bot.rectAt = -Infinity;
  bot.setGazeTarget(point);
  const r = hit.getBoundingClientRect();
  const dock=document.getElementById('info-dock').getBoundingClientRect();
  const overPet=point.x>=r.left&&point.x<=r.right&&point.y>=r.top&&point.y<=r.bottom;
  if(overPet&&!document.body.classList.contains('hover'))window.hudExpansionPointer={x:window.screenX+point.x,y:window.screenY+point.y,until:Date.now()+500};
  const overDockPath=document.body.classList.contains('hover')&&point.x>=Math.min(r.left,dock.left)&&point.x<=Math.max(r.right,dock.right)&&point.y>=r.top&&point.y<=dock.bottom;
  const expanded=document.getElementById('system-toggle').getAttribute('aria-expanded')==='true';
  const anchor=window.hudExpansionPointer;
  const anchorDistance=anchor?Math.hypot(window.screenX+point.x-anchor.x,window.screenY+point.y-anchor.y):Infinity;
  const stationary=anchorDistance<3;
  const keepExpanded=anchor&&(stationary||Date.now()<anchor.until&&anchorDistance<24);
  const sidebar=document.getElementById('dock-side-controls'),side=sidebar?.getBoundingClientRect();
  const overSide=side&&getComputedStyle(sidebar).visibility==='visible'&&point.x>=Math.min(dock.right,side.left)&&point.x<=side.right&&point.y>=side.top&&point.y<=side.bottom;
  const inside=overPet||overDockPath||overSide||quickExpanded||keepExpanded||window.haloSelectOpen;
  const hovering=settings?.hudMode==='hover'?dockHoverGrace.update(!!inside):inside;
  if(expanded&&settings?.hudMode==='hover'&&!hovering){window.hudExpansionPointer=null;window.systemCard.setExpanded(false);}
  document.body.classList.toggle('hover',!!hovering);
  updateMusicControls(false);
}
window.pet.onGaze(handleGaze);

window.pet.ready().then(value => {
  settings = value;
  if(value.hudMode!=='hover')dockHoverGrace.reset();
  hit.setAttribute('aria-label',(value.personality?.name||'软团')+'，抚摸或拖动，右键打开设置');
  toolbarButtons[0].title=value.quickBackend==='api'?'智能对话（API 服务）':'智能对话（使用所选后端额度）';toolbarButtons[0].setAttribute('aria-label',toolbarButtons[0].title);
  syncScenes(value);document.getElementById('quick-focus-minutes').value=value.timerScene.minutes;document.getElementById('quick-focus-visual').value=value.focusVisual;for(const k of ['cpu','memory','gpu','seconds'])document.getElementById('quick-load-'+k).value=value.loadThresholds[k];

  toolbarHost.hidden=true;quickForm.hidden=false;quickControlButton.hidden=false;window.DockUI?.settings(value);
  bot = new GrokCharacter(document.getElementById('character'), {
    mode: 'hold', shape: value.shape, color: value.color, scheme: 'light', loginWrap: true,
    state: 'idle', followPointer: false,
  });
  applySettings(value);
  applyState(value.state || 'idle');
  say('我是'+value.personality.name+'，摸摸我吧 · 右键可以设置', 5000);
}).catch(error => { document.body.dataset.error = error.message; console.error(error); });

for(const button of document.querySelectorAll('[data-focus-quick]'))button.addEventListener('click',async()=>{const type=button.dataset.focusQuick;const r=type==='start'?await window.pet.sceneAction({type:'start'}):type==='stop'&&!lastStats?.focus?.active?await window.pet.sceneAction({type:'stop'}):await window.pet.focusAction({type});document.getElementById('quick-focus-feedback').textContent=r.error||'操作已完成';});
for(const id of ['focus-details','load-details'])document.getElementById(id).addEventListener('toggle',()=>{if(!document.getElementById(id).open)window.holdDockHover();if(document.getElementById(id).open){for(const other of ['focus-details','load-details'])if(other!==id)document.getElementById(other).open=false;window.systemCard.setExpanded(false);}window.systemCard.fit();updateMusicControls();});
document.getElementById('quick-focus-save').addEventListener('click',()=>saveScene(false));
document.getElementById('quick-load-save').addEventListener('click',async()=>{const keys=['cpu','memory','gpu','seconds'];if(keys.some(k=>!document.getElementById('quick-load-'+k).reportValidity()))return;const r=await window.pet.focusAction({type:'settings',minutes:settings.focusMinutes,visual:settings.focusVisual,thresholds:Object.fromEntries(keys.map(k=>[k,Number(document.getElementById('quick-load-'+k).value)]))});document.getElementById('quick-load-feedback').textContent=r.error||'阈值已生效';});

document.getElementById('reminder-shortcut').addEventListener('click',()=>window.pet.companion('panel'));

function syncScenes(value){const select=document.getElementById('quick-scene');for(const option of [...select.options])if(option.value.startsWith('custom-'))option.remove();for(const scene of value.customScenes||[])select.add(new Option(scene.name,scene.id));const scene=value.timerScene;select.value=scene.id;document.getElementById('quick-scene-name').value=scene.name;document.getElementById('quick-scene-kind').value=scene.kind;document.getElementById('quick-scene-title').value=scene.title;document.getElementById('quick-scene-repeat').value=scene.repeat||'';document.getElementById('quick-scene-important').checked=scene.important;document.getElementById('quick-scene-delete').hidden=!scene.id.startsWith('custom-');sceneFields();}
function sceneFields(){const kind=document.getElementById('quick-scene-kind').value;document.getElementById('quick-focus-minutes').closest('label').hidden=kind==='todo';document.getElementById('quick-focus-visual').closest('label').hidden=kind!=='focus';for(const id of ['quick-scene-title','quick-scene-repeat','quick-scene-important'])document.getElementById(id).closest('label').hidden=kind==='focus'||(kind==='todo'&&id!=='quick-scene-title');document.getElementById('quick-focus-minutes').max=kind==='focus'?180:10080;}
async function saveScene(custom){const minutes=document.getElementById('quick-focus-minutes'),name=document.getElementById('quick-scene-name'),kind=document.getElementById('quick-scene-kind').value;if(!name.reportValidity()||kind!=='todo'&&!minutes.reportValidity())return;const r=await window.pet.sceneAction({type:custom?'custom':'save',scene:{id:document.getElementById('quick-scene').value,name:name.value,kind,minutes:Number(minutes.value),title:document.getElementById('quick-scene-title').value,repeat:document.getElementById('quick-scene-repeat').value,important:document.getElementById('quick-scene-important').checked,visual:document.getElementById('quick-focus-visual').value}});document.getElementById('quick-focus-feedback').textContent=r.error||'已保存，下次开始生效';}
document.getElementById('quick-scene').addEventListener('change',async()=>{const r=await window.pet.sceneAction({type:'select',id:document.getElementById('quick-scene').value});document.getElementById('quick-focus-feedback').textContent=r.error||'场景已选择';});document.getElementById('quick-scene-kind').addEventListener('change',sceneFields);document.getElementById('quick-scene-custom').addEventListener('click',()=>saveScene(true));document.getElementById('quick-scene-delete').addEventListener('click',async()=>{const r=await window.pet.sceneAction({type:'delete'});document.getElementById('quick-focus-feedback').textContent=r.error||'已删除场景，已创建的提醒保留';});

document.getElementById('reminder-confirm').addEventListener('click',async event=>{const button=event.currentTarget,id=button.dataset.id;if(!id||button.disabled)return;button.disabled=true;try{const r=await window.pet.reminderAction({type:'acknowledge',id});if(r.error)say(r.error,4000);}finally{button.disabled=false;}});

window.voiceUI=mountVoiceUI({input:quickInput,form:quickForm,open:()=>quickOpen(quickMode),lastAnswer:()=>lastQuickAnswer,say});

document.addEventListener('pointermove',e=>{if(e.target.closest('#pet-hit,#info-dock,#radial .node,#radial button,#choices,.halo-options'))window.pet.pointerReady();},{passive:true});
