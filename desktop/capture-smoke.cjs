'use strict';
// Capture this application's page only. Windows may temporarily have no compositor
// surface after creating, uncovering or scrolling a native window.
module.exports=async function capture(window,label){
  for(let attempt=0;attempt<3;attempt++){
    window.show();window.focus();
    await window.webContents.executeJavaScript('new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(resolve));setTimeout(resolve,300);})');
    try{
      const shot=await window.webContents.capturePage(undefined,{stayAwake:true});
      if(shot.isEmpty())throw new Error('empty compositor image');
      return shot;
    }catch(error){
      if(attempt===2)throw new Error(label+': '+error.message,{cause:error});
      console.log('Retrying page capture:',label,error.message);
      await new Promise(resolve=>setTimeout(resolve,200));
    }
  }
};
