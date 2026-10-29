'use strict';
const templates={bing:'https://www.bing.com/search?q={query}',google:'https://www.google.com/search?q={query}',baidu:'https://www.baidu.com/s?wd={query}'};
function searchUrl(text,engine='bing',custom=''){
 if(typeof text!=='string'||!text.trim()||text.length>8000)throw new Error('请输入1至8000字的搜索内容');
 const template=engine==='custom'?custom:templates[engine];
 if(typeof template!=='string'||!template.includes('{query}')||template.length>2000)throw new Error('搜索模板需要包含 {query}');
 let url;try{url=new URL(template.replaceAll('{query}',encodeURIComponent(text.trim())));}catch{throw new Error('搜索地址无效');}
 if(url.protocol!=='https:'||url.username||url.password)throw new Error('搜索地址必须是无账号信息的HTTPS地址');
 return url.href;
}
module.exports={searchUrl,templates};
