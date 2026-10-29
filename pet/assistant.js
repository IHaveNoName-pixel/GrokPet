'use strict';
const $=id=>document.getElementById(id);let chat={busy:false,messages:[]},submitting=false;
const labels={loading:'正在连接…',sending:'正在发送…',thinking:'正在等待回复…',receiving:'正在接收回复…',searching:'正在搜索…',working:'正在读取参考内容…',confused:'操作未完成',sad:'本次问答失败',proud:'回复完成'};
function appendMarkdown(container,text){
 const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  let line=lines[i];const heading=line.match(/^(#{1,3})\s+(.+)$/);const parent=document.createElement(heading?'strong':'span');if(heading){parent.className='md-heading';line=heading[2];}
  const pattern=/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;let offset=0,match;
  while((match=pattern.exec(line))){parent.append(document.createTextNode(line.slice(offset,match.index)));const token=match[0],tag=token.startsWith('**')?'strong':token.startsWith('`')?'code':'em';const el=document.createElement(tag);el.textContent=token.slice(tag==='strong'?2:1,tag==='strong'?-2:-1);parent.append(el);offset=match.index+token.length;}
  parent.append(document.createTextNode(line.slice(offset)));container.append(parent);if(i<lines.length-1)container.append(document.createElement('br'));
 }
}
function render(value){
 chat=value||chat;const box=$('messages');const scroll=box.scrollTop;const nearBottom=box.scrollHeight-scroll-box.clientHeight<60;
 box.replaceChildren();
 if(!chat.messages.length){const p=document.createElement('p');p.className='empty';p.textContent='输入一个问题开始。尚未发送任何内容。';box.append(p);}
 for(const message of chat.messages){const article=document.createElement('div');article.className='message '+message.role;const label=document.createElement('b');label.textContent=message.role==='user'?'你':chat.provider||'Codex';article.append(label);for(const [i,part] of message.text.split(/```/).entries()){if(i%2){const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=part;pre.append(code);article.append(pre);}else{const text=document.createElement('span');appendMarkdown(text,part);article.append(text);}}box.append(article);}
 box.scrollTop=nearBottom?box.scrollHeight:scroll;
 const codex=['codex','api'].includes($('mode').value);$('status').textContent=codex?(chat.error||labels[chat.phase]||($('mode').value==='api'?'API 聊天 · 使用所选服务额度':'只读问答 · 使用 Codex 额度')):chat.busy?'Codex 问答在后台运行':$('mode').value==='search'?'在默认浏览器中搜索':'复制问题，在 ChatGPT 官网继续';$('stop').hidden=!chat.busy||chat.owner==='pet';$('send').disabled=submitting||chat.busy&&codex;
 for(const id of ['choose-project','clear-project','new-chat'])$(id).disabled=chat.busy;
}
function info(value){if(!value)return;if(value.api)apiInfo(value.api);$('engine').value=value.searchEngine;$('template').value=value.searchTemplate;$('project').textContent=value.project||'未选择参考项目';if(!$('animation').options.length)for(const [key,label]of Object.entries(value.actions)){const option=document.createElement('option');option.value=key;option.textContent=label+' · '+key;$('animation').append(option);}render(value.chat);mode();}
async function act(value){const result=await window.pet.assistantAction(value);if(result.error)throw new Error(result.error);return result;}
function mode(){const selected=$('mode').value,codex=['codex','api'].includes(selected);document.body.dataset.mode=selected;$('project-row').hidden=selected!=='codex';$('messages').hidden=!codex;$('new-chat').hidden=!codex;$('mode-help').textContent=selected==='local'?'示例：开始专注25分钟、暂停音乐、隐藏系统卡片、10分钟后提醒我喝水、明天下午3点提醒我交材料、添加待办：整理桌面。只执行明确的本地指令。':selected==='api'?'发送到当前选中的 API 服务与模型；聊天内容会交给该服务。切换后端会开启新会话。':codex?'使用 Codex 额度，只读参考项目。此窗口与桌宠快捷问答的上下文独立；选择新项目会开启新会话。':selected==='search'?'在系统默认浏览器中打开结果，不会调用 Codex。':'问题会复制到剪贴板，并打开 ChatGPT 官网，由你粘贴发送。ChatGPT 自身的使用限制仍适用。';$('send').textContent=selected==='local'?'执行':codex?'发送':selected==='search'?'搜索':'打开 ChatGPT';render(chat);}
$('mode').addEventListener('change',mode);
$('composer').addEventListener('submit',async event=>{event.preventDefault();const text=$('question').value,mode=$('mode').value;if(submitting||!text.trim())return;submitting=true;$('feedback').textContent='';$('send').disabled=true;try{const result=await act({type:'send',mode,text});if($('question').value===text&&$('mode').value===mode)$('question').value='';if(result.message)$('feedback').textContent=result.message;else if(mode==='search')$('feedback').textContent='已在浏览器中打开搜索';}catch(error){$('feedback').textContent=error.message;}finally{submitting=false;render(chat);}});
$('question').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!$('send').disabled)$('composer').requestSubmit();}});
$('question').addEventListener('focus',()=>window.pet.assistantFocus(true));$('question').addEventListener('blur',()=>window.pet.assistantFocus(false));
for(const [id,type]of [['stop','stop'],['new-chat','new'],['choose-project','project'],['clear-project','clear-project'],['inspect','inspect']])$(id).addEventListener('click',async()=>{try{const result=await act({type});if(result.info)info(result.info);}catch(error){$('feedback').textContent=error.message;}});
$('save-search').addEventListener('click',async()=>{try{await act({type:'search-settings',engine:$('engine').value,template:$('template').value});$('feedback').textContent='搜索设置已保存';}catch(error){$('feedback').textContent=error.message;}});
for(const [id,state]of [['preview',undefined],['cancel-preview',null]])$(id).addEventListener('click',async()=>{try{await act({type:'preview',state:state===undefined?$('animation').value:state});}catch(error){$('feedback').textContent=error.message;}});
window.pet.onAssistant(render);window.pet.assistantInfo().then(info).catch(error=>$('feedback').textContent=error.message);

window.pet.onReplyView(value=>{ $('reply-view-text').textContent=value.text;$('reply-view').hidden=false;$('reply-view').scrollIntoView({block:'start'});});
$('reply-view-close').addEventListener('click',()=>{$('reply-view').hidden=true;});

let apiProfiles=[];
function apiInfo(value){apiProfiles=value.profiles||[];const select=$('api-profile');select.replaceChildren(new Option('新建配置',''));for(const p of apiProfiles)select.append(new Option(p.name+' · '+p.model,p.id));select.value=value.active||'';$('api-quick').checked=!!value.quick;apiFields();}
function apiFields(){const p=apiProfiles.find(p=>p.id===$('api-profile').value);$('api-name').value=p?.name||'';$('api-base').value=p?.baseUrl||'';$('api-model').value=p?.model||'';$('api-key').value='';$('api-clear-key').checked=false;$('api-status').textContent=p?(p.hasKey?'已保存密钥（系统加密）':'未保存密钥'):'填写后保存，不会自动发送测试请求';}
$('api-profile').addEventListener('change',async()=>{apiFields();if(!$('api-profile').value)return;try{apiInfo((await act({type:'api-select',id:$('api-profile').value})).api);}catch(e){$('api-status').textContent=e.message;}});
$('api-new').addEventListener('click',()=>{$('api-profile').value='';apiFields();});
$('api-save').addEventListener('click',async()=>{try{const r=await act({type:'api-save',profile:{id:$('api-profile').value,name:$('api-name').value,baseUrl:$('api-base').value,model:$('api-model').value,key:$('api-key').value,clearKey:$('api-clear-key').checked,quick:$('api-quick').checked}});apiInfo(r.api);$('api-status').textContent='配置已保存，可选择 API 模式发送问题';}catch(e){$('api-status').textContent=e.message;}});
$('api-delete').addEventListener('click',async()=>{if(!$('api-profile').value)return;try{apiInfo((await act({type:'api-delete',id:$('api-profile').value})).api);}catch(e){$('api-status').textContent=e.message;}});

window.pet.onOpenApiSettings(()=>{$('api-settings').open=true;$('mode').value='api';mode();$('api-settings').scrollIntoView({block:'start'});});

function fillVoice(config){for(const kind of ['stt','tts']){const p=config[kind]||{};$('voice-'+kind+'-backend').value=p.backend||'windows';$('voice-'+kind+'-api').hidden=p.backend!=='api';$('voice-'+kind+'-base').value=p.baseUrl||'';$('voice-'+kind+'-model').value=p.model||'';$('voice-'+kind+'-key').value='';$('voice-'+kind+'-clear').checked=false;$('voice-'+kind+'-saved').textContent=p.hasKey?'密钥已保存（Windows 加密）':'未保存密钥';} $('voice-tts-voice').value=config.tts?.voice||'';$('voice-auto').checked=!!config.autoSpeak;$('voice-shortcut').value=config.shortcut||'';}
window.pet.voice({type:'info'}).then(r=>{if(r.error)throw Error(r.error);fillVoice(r.config);if(r.config.shortcut&&!r.shortcutActive)$('voice-settings-status').textContent='快捷键未注册，可能已被占用，请重新保存或更换';}).catch(e=>$('voice-settings-status').textContent=e.message);
$('voice-save').onclick=async()=>{const config={autoSpeak:$('voice-auto').checked,shortcut:$('voice-shortcut').value};for(const kind of ['stt','tts'])config[kind]={backend:$('voice-'+kind+'-backend').value,baseUrl:$('voice-'+kind+'-base').value,model:$('voice-'+kind+'-model').value,key:$('voice-'+kind+'-key').value,clearKey:$('voice-'+kind+'-clear').checked,...(kind==='tts'?{voice:$('voice-tts-voice').value}:{})};$('voice-save').disabled=true;try{const r=await window.pet.voice({type:'save',config});if(r.error)throw Error(r.error);fillVoice(r.config);$('voice-settings-status').textContent='已保存。回到桌宠点击麦克风开始验证；未发起测试请求。';}catch(e){$('voice-settings-status').textContent=e.message;}finally{$('voice-save').disabled=false;}};

for(const kind of ['stt','tts'])$('voice-'+kind+'-backend').onchange=()=>{$('voice-'+kind+'-api').hidden=$('voice-'+kind+'-backend').value!=='api';};
