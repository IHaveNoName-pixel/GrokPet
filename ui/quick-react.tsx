import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {HaloSearchInput} from './vendor/cult/halo-search';
import {PopoverForm} from './vendor/cult/popover-form';
function App(){
 const [mounted,setMounted]=useState(false);
 const [open,setOpen]=useState(false),[mode,setMode]=useState('codex'),[value,setValue]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const fn=(e:any)=>{setMounted(true);setMode(e.detail);setOpen(true)};window.addEventListener('pet-quick-open',fn);const close=()=>{setOpen(false);setMounted(false)};window.addEventListener('pet-quick-reset',close);return()=>{window.removeEventListener('pet-quick-open',fn);window.removeEventListener('pet-quick-reset',close)}},[]);
 function changeOpen(next:boolean){setOpen(next);if(!next)window.dispatchEvent(new Event('pet-quick-close'))}
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!value.trim())return;setBusy(true);window.dispatchEvent(new CustomEvent('pet-quick-start',{detail:{mode}}));try{const text=value;const result=await (window as any).pet.assistantAction({type:'send',mode,text});if(result.error)throw new Error(result.error);setValue('');window.dispatchEvent(new CustomEvent('pet-quick-sent',{detail:{mode}}));}catch(error:any){window.dispatchEvent(new CustomEvent('pet-quick-error',{detail:error.message}))}finally{setBusy(false)}}
 if(!mounted)return null;
 return <PopoverForm open={open} setOpen={changeOpen} title="问一问" showSuccess={false} width="350px" height="58px" openChild={<form id="quick-form" onSubmit={submit}><HaloSearchInput lightweight id="quick-input" aria-label="问题或搜索内容" placeholder="问点什么…" value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')changeOpen(false)}}/><button id="quick-send" aria-label="发送" disabled={busy}>↑</button><button id="quick-close" type="button" aria-label="关闭" onClick={()=>changeOpen(false)}>×</button></form>}/>;
}
flushSync(()=>createRoot(document.getElementById('quick-react')!).render(<App/>));
