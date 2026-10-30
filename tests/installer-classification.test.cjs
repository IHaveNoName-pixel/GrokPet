'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
test('native installer recognition supports vendor-named InstallShield and rejects unrelated/uninstall windows',{skip:process.platform!=='win32'},()=>{const exe=path.join(__dirname,'../.runtime/bridge/BlobPetBridge.exe');const classify=(name,title)=>JSON.parse(execFileSync(exe,['--transfer-probe','--classify',name,title],{windowsHide:true,encoding:'utf8'})).source;
 assert.equal(classify('三维装配大师7.2.4.53(64bit)','三维装配大师 - InstallShield Wizard'),'install');assert.equal(classify('setup','应用安装'),'install');assert.equal(classify('chrome','InstallShield 使用教程'),null);assert.equal(classify('unins000','应用卸载'),null);});
