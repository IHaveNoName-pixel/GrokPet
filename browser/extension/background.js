'use strict';
const HOST='com.blobpet.downloads', source=navigator.userAgent.includes('Edg/')?'edge':'chrome';let port=null,timer=null;const active=new Set();
function connect(){if(port)return port;try{port=chrome.runtime.connectNative(HOST);port.onDisconnect.addListener(()=>{port=null;});port.onMessage.addListener(()=>{});return port;}catch{return null;}}
function baseName(path){return String(path||'').split(/[\\/]/).pop().slice(0,120)}
async function enabled(){return (await chrome.storage.local.get({enabled:true})).enabled===true;}
function send(item){const state=item.state==='in_progress'?(item.paused?'paused':'active'):item.state==='complete'?'complete':item.state==='interrupted'?'interrupted':null;if(!state)return;if(state==='active')active.add(item.id);else active.delete(item.id);connect()?.postMessage({source,id:String(item.id),state,name:baseName(item.filename),received:Number.isFinite(item.bytesReceived)?item.bytesReceived:null,total:Number.isFinite(item.totalBytes)&&(!Number.isFinite(item.bytesReceived)||item.totalBytes<0||item.bytesReceived<=item.totalBytes)?item.totalBytes:null});}
async function poll(){if(!await enabled()){active.clear();clearInterval(timer);timer=null;return;}for(const id of [...active]){try{const items=await chrome.downloads.search({id});if(items[0])send(items[0]);else active.delete(id);}catch{active.delete(id);}}if(!active.size){clearInterval(timer);timer=null;}}
function startPolling(){if(!timer)timer=setInterval(poll,1500);}
chrome.downloads.onCreated.addListener(async item=>{if(await enabled()){send(item);if(active.size)startPolling();}});
chrome.downloads.onChanged.addListener(async delta=>{if(!await enabled())return;const items=await chrome.downloads.search({id:delta.id});if(items[0]){send(items[0]);if(active.size)startPolling();}});
chrome.runtime.onStartup.addListener(async()=>{if(await enabled())for(const item of await chrome.downloads.search({state:'in_progress'})){send(item);if(active.size)startPolling();}});
chrome.runtime.onInstalled.addListener(async()=>{if(await enabled())for(const item of await chrome.downloads.search({state:'in_progress'})){send(item);if(active.size)startPolling();}});
