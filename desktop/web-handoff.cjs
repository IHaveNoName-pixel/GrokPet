'use strict';
let busy=false;
async function handoffChatGPT(text,{open,copy}){
 if(typeof text!=='string'||!text.trim()||text.length>8000)throw new Error('请输入1至8000字的问题');
 if(busy)throw new Error('上一次打开尚未完成，请稍候再发送');
 busy=true;
 try{await open('https://chatgpt.com/');await copy(text.trim());return {ok:true,message:'问题已复制，已打开 ChatGPT。请粘贴后发送。'};}
 finally{busy=false;}
}
module.exports={handoffChatGPT};
