'use strict';
const $ = id => document.getElementById(id);
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>document.getElementById(button.dataset.section)?.scrollIntoView({block:'start'}));
const speed = n => n === null || n === undefined ? '—' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB/s' : (n / 1024).toFixed(1) + ' KB/s';
const time = n => n ? new Date(n).toLocaleString('zh-CN') : '尚未更新';
const hudKeys = ['codex','network','vpn','cpu','memory','gpu','music'];
function displaySettings(s) {
  if (!s) return;
  $('pet-name').value=s.personality.name;$('pet-activity').value=s.personality.activity;$('pet-schedule').checked=s.personality.scheduleEnabled;$('pet-sleep').value=s.personality.sleepAt;$('pet-wake').value=s.personality.wakeAt;
  $('work-enabled').checked=s.workEnabled!==false;
  $('hud-mode').value = s.hudMode;
  $('focus-minutes').value=s.focusMinutes;$('focus-visual').value=s.focusVisual;for(const k of ['cpu','memory','gpu','seconds'])$('load-'+k).value=s.loadThresholds[k];
  for(const k of ['music','transfer','toolbar','system','focus','load','work'])$('dock-'+k).checked=s.dockItems?.[k]!==false;
  $('hud-font').value = String(s.hudFontSize);
  for (const key of hudKeys) $('hud-'+key).checked = !!s.hudItems?.[key];
  for (const key of hudKeys.filter(k=>k!=='music')) $('summary-'+key).checked=!!s.summaryItems?.[key];
  $('summary-order').value=(s.summaryOrder||[]).join(', ');$('summary-max').value=s.summaryMax||12;
  for(const key of ['edge','chrome','thunder','baidu','install'])$('transfer-'+key).checked=!!s.transferSources?.[key];
  $('start-at-login').checked = !!s.startup?.enabled;
  $('startup-status').textContent = s.startup?.enabled ? '已启用，将使用当前程序路径启动' : s.startup?.registered ? '启动项已注册，但已被 Windows 禁用' : '未启用开机启动';
  $('music-enabled').checked=!!s.musicEnabled;$('music-bubbles').checked=!!s.musicBubbles;$('music-lyrics').checked=!!s.musicLyrics;
}
async function saveDisplay() {
  try {
    const patch = {dockItems:Object.fromEntries(['music','transfer','toolbar','system','focus','load','work'].map(k=>[k,$('dock-'+k).checked])),hudMode:$('hud-mode').value,hudFontSize:Number($('hud-font').value),hudItems:Object.fromEntries(hudKeys.map(k=>[k,$('hud-'+k).checked])),summaryOrder:$('summary-order').value.split(/[,，\s]+/).filter(Boolean),summaryMax:Number($('summary-max').value),summaryItems:Object.fromEntries(hudKeys.filter(k=>k!=='music').map(k=>[k,$('summary-'+k).checked]))};
    const result = await window.pet.hudSettings(patch);
    $('display-feedback').textContent = result.error || '显示设置已保存';
  } catch (e) {$('display-feedback').textContent=e.message;}
}
for (const id of [...['music','transfer','toolbar','system','focus','load','work'].map(k=>'dock-'+k),'hud-mode','hud-font','summary-order','summary-max',...hudKeys.map(k=>'hud-'+k),...hudKeys.filter(k=>k!=='music').map(k=>'summary-'+k)]) $(id).addEventListener('change',saveDisplay);
const transferKeys=['edge','chrome','thunder','baidu','install'];
for(const key of transferKeys)$('transfer-'+key).addEventListener('change',async()=>{const r=await window.pet.transferSettings(Object.fromEntries(transferKeys.map(k=>[k,$('transfer-'+k).checked])));$('transfer-feedback').textContent=r.error||'联动设置已保存';});
$('browser-bridge-setup').addEventListener('click',async()=>{const r=await window.pet.companion('browser-bridge-setup');$('transfer-feedback').textContent=r.error||'桥接已注册，请在浏览器加载打开的扩展目录';});
$('start-at-login').addEventListener('change',async()=>{
  const control=$('start-at-login');control.disabled=true;
  try {const r=await window.pet.startup(control.checked);$('display-feedback').textContent=r.error||'开机启动设置已更新';displaySettings(await window.pet.ready());}
  catch(e){$('display-feedback').textContent=e.message;}
  finally{control.disabled=false;}
});
window.pet.onSettings(displaySettings);window.pet.ready().then(displaySettings);
for(const id of ['music-enabled','music-bubbles','music-lyrics'])$(id).addEventListener('change',async()=>{
  try{const r=await window.pet.musicSettings({musicEnabled:$('music-enabled').checked,musicBubbles:$('music-bubbles').checked,musicLyrics:$('music-lyrics').checked});$('music-feedback').textContent=r.error||'音乐设置已保存';}catch(e){$('music-feedback').textContent=e.message;}
});
$('lyrics-import').addEventListener('click',async()=>{
  try{const r=await window.pet.companion('lyrics-import');$('music-feedback').textContent=r.error||'歌词选择已完成';}catch(e){$('music-feedback').textContent=e.message;}
});
$('music-sync').addEventListener('click',async()=>{
  const value=$('music-sync-time').value.trim();let seconds;
  const match=value.match(/^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/);
  if(match)seconds=Number(match[1])*60+Number(match[2])+Number((match[3]||'').padEnd(3,'0'))/1000;
  else seconds=value!==''?Number(value):NaN;
  if(!Number.isFinite(seconds)||seconds<0||seconds>86400){$('music-feedback').textContent='请输入有效的分:秒或秒数';return;}
  const r=await window.pet.musicCalibrate(seconds*1000);$('music-feedback').textContent=r.error||'已按手动时间同步；播放器跳转后请重新校准';
});
$('music-sync-clear').addEventListener('click',async()=>{const r=await window.pet.musicCalibrate(null);$('music-feedback').textContent=r.error||'已清除手动校准';});
function renderMusic(m){
  const state=({playing:'正在播放',paused:'已暂停',stopped:'已停止',opened:'已就绪',changing:'正在切换'})[m.state]||'等待播放';
  $('music-status').textContent=m.status==='ready'?state:(m.reason||'等待网易云音乐');
  $('music-track').textContent=m.title||'';$('music-artist').textContent=m.artist?m.artist+(m.album?' · '+m.album:''):'';
  const clock=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  $('music-progress').hidden=typeof m.percent!=='number';if(typeof m.percent==='number')$('music-progress').value=m.percent;
  $('music-time').textContent=m.timelineSource==='manual'?'手动同步 · '+clock(m.positionMs)+'（非播放器真实进度）':m.timelineSource==='system'?clock(m.positionMs)+' / '+clock(m.durationMs)+' · 播放器时间轴':'网易云未提供时间轴；可导入LRC后手动校准';
  $('lyrics-status').textContent=m.lyricsName?'本地歌词：'+m.lyricsName+(m.lyric?.text?'\n当前：'+m.lyric.text:''):'尚未为当前歌曲导入本地歌词';
  $('lyrics-import').disabled=!m.trackKey;$('music-sync').disabled=!m.trackKey||m.timelineSource==='system';
  $('music-sync-clear').disabled=m.timelineSource!=='manual';
}
function render(s) {
  if (!s) return;
  renderMusic(s.media||{});
  const statuses=s.transfers?.status||{};$('transfer-source-status').textContent=transferKeys.map(k=>({edge:'Edge',chrome:'Chrome',thunder:'迅雷',baidu:'百度网盘',install:'安装'})[k]+'：'+(statuses[k]||'未启用')).join(' · ');
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
  $('activity').textContent = ({thinking:'Codex 正在分析或等待下一步',searching:'Codex 正在搜索',writing:'Codex 正在修改文件',working:'Codex 正在执行工具',alerting:'Codex 需要你处理',confused:'刚刚观察到工具失败',sad:'本轮结束，最后工具状态为失败',proud:'本轮已结束',celebrate:'本轮刚刚结束'})[s.activity] || (s.hooks ? '未观察到运行中任务' : '尚未接入工作状态');
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

async function focusSettings(){return window.pet.focusAction({type:'settings',minutes:Number($('focus-minutes').value),visual:$('focus-visual').value,thresholds:Object.fromEntries(['cpu','memory','gpu','seconds'].map(k=>[k,Number($('load-'+k).value)]))});}
$('focus-save').addEventListener('click',async()=>{const r=await focusSettings();$('focus-feedback').textContent=r.error||'计时与阈值设置已保存';displaySettings(await window.pet.ready());});
for(const b of document.querySelectorAll('[data-focus]'))b.addEventListener('click',async()=>{if(b.dataset.focus==='start')await focusSettings();const r=await window.pet.focusAction({type:b.dataset.focus});$('focus-feedback').textContent=r.error||'计时状态已更新';});
window.pet.onStats(s=>{const f=s.focus;if(!f)return;const seconds=Math.ceil(f.remainingMs/1000);$('focus-status').textContent=({idle:'尚未开始',running:'专注中',paused:'已暂停',complete:'已完成'})[f.state]+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');for(const b of document.querySelectorAll('[data-focus]'))b.disabled=b.dataset.focus==='pause'?f.state!=='running':b.dataset.focus==='resume'?f.state!=='paused':b.dataset.focus==='stop'?!f.active:false;});

$('open-api-settings').addEventListener('click',()=>window.pet.companion('api-settings'));

let reminderSignature='';
window.pet.onStats(s=>{const data=s.reminders;if(!data)return;const key=JSON.stringify(data);if(key===reminderSignature)return;reminderSignature=key;if(data.error){$('reminder-feedback').textContent=data.error;return;}window.pendingReminders=data;window.ArcUI?.renderReminders?.(data);});
$('reminder-add').addEventListener('click',async()=>{if(!$('reminder-title').reportValidity())return;const r=await window.pet.reminderAction({type:'add',title:$('reminder-title').value,at:$('reminder-at').value,repeat:$('reminder-repeat').value,important:$('reminder-important').checked});$('reminder-feedback').textContent=r.error||'已添加';if(!r.error)$('reminder-title').value='';});

$('pet-personality-save').addEventListener('click',async()=>{if(!['pet-name','pet-sleep','pet-wake'].every(id=>$(id).reportValidity()))return;const r=await window.pet.personalitySettings({name:$('pet-name').value,activity:$('pet-activity').value,scheduleEnabled:$('pet-schedule').checked,sleepAt:$('pet-sleep').value,wakeAt:$('pet-wake').value});$('pet-personality-feedback').textContent=r.error||'已保存，空闲时按新设置陪伴';});
function renderWellbeing(s){if(!s?.life)return;for(const k of ['energy','mood','affection']){$('pet-'+k).value=s.life[k];$('pet-'+k+'-value').textContent=Math.round(s.life[k])+' / 100';}}
window.pet.onStats(renderWellbeing);window.pet.stats().then(renderWellbeing);

async function systemAction(c){const r=await window.pet.systemCommand(c);$('system-feedback').textContent=r.error||r.message;return r;}
async function refreshLaunch(c){const r=await window.pet.launchTargets(c);if(r.error){$('system-feedback').textContent=r.error;return;}const list=$('launch-list');list.replaceChildren();for(const t of r.items||[]){const row=document.createElement('p'),name=document.createElement('span');name.textContent=t.name+' · '+t.path+' ';row.append(name);for(const [label,action]of [['打开',()=>systemAction({type:'launch',id:t.id})],['移除配置',()=>refreshLaunch({type:'remove',id:t.id})]]){const b=document.createElement('button');b.textContent=label;b.onclick=action;row.append(b);}list.append(row);}}
$('launch-add').onclick=()=>refreshLaunch({type:'add',name:$('launch-name').value,kind:$('launch-kind').value});
$('volume-get').onclick=()=>systemAction({type:'volume',action:'get'});$('volume-set').onclick=()=>{if($('master-volume').reportValidity())systemAction({type:'volume',action:'set',value:Number($('master-volume').value)});};$('volume-undo').onclick=()=>systemAction({type:'volume',action:'undo'});$('system-query').onclick=()=>systemAction({type:'system-status'});refreshLaunch();

$('open-radial').onclick=()=>window.pet.quickAction({type:'open'});
$('master-volume').oninput=()=>{$('master-volume-value').textContent=$('master-volume').value+'%';};
$('master-volume').onchange=async()=>{const value=Number($('master-volume').value);$('master-volume').disabled=true;try{await systemAction({type:'volume',action:'set',value});}finally{await loadMasterVolume();}};
async function loadMasterVolume(){try{const s=await window.pet.quickStatus();if(s.volume?.ok){$('master-volume').value=s.volume.volume;$('master-volume-value').textContent=s.volume.volume+'%';$('master-volume').disabled=false;}}catch(e){$('system-feedback').textContent=e.message;}}
loadMasterVolume();

const workTypes={'turn.started':'开始对话','tool.started':'工具开始','tool.completed':'工具返回','approval.requested':'等待审批','turn.completed':'对话结束','task.verified':'任务验收'};
const workStatuses={idle:'本轮对话结束 · 未验收任务',running:'进行中',waiting_approval:'等待你处理',succeeded:'任务验收通过',failed:'操作失败',cancelled:'已取消',unknown:'状态未知'};
let workSignature='';
function renderWork(s){if(!s?.work)return;const w=s.work,key=JSON.stringify([w,s.projects?.items.map(x=>[x.id,x.name])]);if(key===workSignature)return;workSignature=key;$('work-summary').textContent=!w.enabled?'工作事件中心已关闭':`进行中 ${w.counts.running} · 待处理 ${w.counts.waiting_approval} · 状态未知 ${w.counts.unknown}`;$('work-connection').textContent='Codex Hooks：'+(({online:'已连接',offline:'已断线，等待新事件恢复'})[w.connections.codex?.status]||'尚未连接');const list=$('work-sessions');list.replaceChildren();for(const item of w.sessions.slice(-8).reverse()){const row=document.createElement('p');row.className='muted';row.textContent=[({codex:'Codex',git:'Git',vscode:'VS Code'})[item.source]||item.source,item.projectId==='unassigned'?'未提供项目':(s.projects?.items.find(p=>p.id===item.projectId)?.name||'项目 '+item.projectId.slice(-8)),'会话 '+item.sessionId.slice(-8),item.type==='task.verified'&&item.status==='failed'?'任务验收失败':workStatuses[item.status]||'状态未知'].join(' · ');list.append(row);}const history=$('work-events');history.replaceChildren();for(const item of w.events.slice(-20).reverse()){const row=document.createElement('p');row.className='muted';row.textContent=[new Date(item.timestamp).toLocaleTimeString(),item.source,workTypes[item.type]||item.type,workStatuses[item.status]||'状态未知'].join(' · ');history.append(row);}}
$('work-enabled').addEventListener('change',async()=>{const input=$('work-enabled');input.disabled=true;try{const r=await window.pet.workSettings(input.checked);$('work-feedback').textContent=r.error||'已保存';if(r.error)input.checked=!input.checked;}catch{$('work-feedback').textContent='保存失败，请重试';input.checked=!input.checked;}finally{input.disabled=false;}});
window.pet.onStats(renderWork);window.pet.stats().then(renderWork);

let projectsSignature='';
const gitLabels={clean:'干净',dirty:'有未提交修改',conflict:'存在冲突',unavailable:'不可用',unknown:'等待检查',disabled:'监测已停止'};
function renderProjects(stats){const data=stats?.projects;if(!data)return;const signature=JSON.stringify(data);if(signature===projectsSignature)return;projectsSignature=signature;$('projects-enabled').checked=data.enabled;const list=$('project-list');list.replaceChildren();if(data.error)$('project-feedback').textContent=data.error;for(const item of data.items){const card=document.createElement('article');card.className='git-project';const heading=document.createElement('strong');heading.textContent=item.name+(item.id===data.selectedId?' · 当前项目':'');const status=document.createElement('p');status.textContent=gitLabels[item.status]||'状态未知';status.className='git-state git-state-'+item.status;const info=document.createElement('p');info.className='muted';info.textContent=[item.branch,item.counts?`修改 ${item.counts.changed} · 未跟踪 ${item.counts.untracked} · 冲突 ${item.counts.conflicts}`:'',item.commit?item.commit.hash+' '+item.commit.title:'',item.checkedAt?'检查于 '+new Date(item.checkedAt).toLocaleTimeString():'',item.error||''].filter(Boolean).join(' · ');const location=document.createElement('p');location.className='muted git-path';location.textContent=item.path;card.append(heading,status,info,location);for(const [action,title]of [['select','选择'],['remove','移除登记']]){const button=document.createElement('button');button.type='button';button.textContent=title;button.disabled=action==='select'&&item.id===data.selectedId;button.addEventListener('click',()=>projectAction({action,id:item.id}));card.append(button);}list.append(card);}if(!data.items.length)list.textContent='尚未登记 Git 项目';}
let projectBusy=false;
async function projectAction(request){if(projectBusy)return;projectBusy=true;const buttons=[...document.querySelectorAll('#project-list button,#project-add,#project-refresh,#projects-enabled')];for(const b of buttons)b.disabled=true;$('project-feedback').textContent='正在处理…';try{const r=await window.pet.projects(request);$('project-feedback').textContent=r.error||(r.cancelled?'已取消':'已更新');if(r.projects)renderProjects({projects:r.projects});}catch(e){$('project-feedback').textContent=e.message;}finally{projectBusy=false;for(const b of buttons)if(b.isConnected)b.disabled=false;projectsSignature='';window.pet.stats().then(renderProjects);}}
$('project-add').addEventListener('click',()=>{const name=$('project-name').value.trim();projectAction({action:'add',...(name?{name}:{})});});
$('project-refresh').addEventListener('click',()=>projectAction({action:'refresh'}));
$('projects-enabled').addEventListener('change',()=>projectAction({action:'enabled',value:$('projects-enabled').checked}));
window.pet.onStats(renderProjects);window.pet.stats().then(renderProjects);

for(const type of ['pair','disable','extension'])$('vscode-'+type).onclick=async()=>{const r=await window.pet.vscode({type});$('vscode-feedback').textContent=r.error||(type==='pair'?'已生成文件。在 VS Code 执行 GrokPet: 导入本机配对文件。':type==='disable'?'授权已撤销':'已定位安装包，请在 VS Code 从 VSIX 安装');};
window.pet.onStats(s=>{const v=s.vscode;if(!v)return;$('vscode-status').textContent=v.error||(!v.enabled?'联动已关闭':`已配对 ${v.paired||0} · 在线工作区 ${v.sessions.filter(x=>x.connected).length}`);});
