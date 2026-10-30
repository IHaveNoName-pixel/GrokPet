'use strict';
function registerProjectIpc({ipcMain,authorized,pick,getMonitor,emit}){
 let busy=false;
 ipcMain.handle('pet:projects',async(event,request)=>{
  if(!authorized(event))return {error:'请在设置窗口管理项目'};
  if(!request||typeof request!=='object'||Array.isArray(request)||!['add','select','remove','refresh','enabled'].includes(request.action))return {error:'无效的项目操作'};
  if(busy)return {error:'正在处理项目操作，请稍候'};
  busy=true;
  try{
   const monitor=getMonitor(),store=monitor.store;
   if(request.action==='add'){if(request.name!==undefined&&(typeof request.name!=='string'||!request.name.trim()||request.name.length>80))throw Error('请输入有效项目名称');const dir=await pick();if(!dir)return {cancelled:true};await store.add(dir,request.name);await monitor.changed();}
   if(['select','remove'].includes(request.action)){if(typeof request.id!=='string'||request.id.length>240)throw Error('项目未登记');store[request.action](request.id);if(request.action==='remove')await monitor.changed();}
   if(request.action==='enabled')await monitor.setEnabled(request.value);
   if(request.action==='refresh')await monitor.refresh();
   emit();return {ok:true,projects:monitor.view()};
  }catch(e){return {error:e.message};}finally{busy=false;}
 });
}
module.exports={registerProjectIpc};
