'use strict';
const {execFile}=require('node:child_process');const {promisify}=require('node:util');
function createMediaController(bridge,run=promisify(execFile)){
  let busy=false;
  return async(action,enabled)=>{
    if(!['previous','toggle','next'].includes(action))throw new Error('无效的音乐操作');
    if(!enabled)throw new Error('音乐联动已关闭');
    if(!bridge)throw new Error('缺少媒体桥接程序');
    if(busy)throw new Error('请等待上一次音乐操作完成');
    busy=true;
    try{
      const {stdout}=await run(bridge,['--media-command',action,'--parent',String(process.pid)],{windowsHide:true,timeout:4000,maxBuffer:8192});
      const result=JSON.parse(stdout.trim());
      if(result.ok!==true)throw new Error(result.reason||'网易云未接受此操作');
      return result;
    }catch(error){throw new Error(error.killed?'音乐控制超时，请在网易云中重试':error.message);}
    finally{busy=false;}
  };
}
module.exports={createMediaController};
