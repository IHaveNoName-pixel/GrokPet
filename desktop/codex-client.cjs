'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function findCodex() {
  const candidates = [path.join(os.homedir(), 'AppData/Local/Programs/OpenAI/Codex/bin/codex.exe'),
    ...(process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, 'codex.exe'))];
  return candidates.find(file => fs.existsSync(file));
}
class CodexClient {
  constructor({spawnImpl=spawn,executable=null}={}) { this.spawnImpl=spawnImpl;this.executable=executable;this.child = null; this.pending = new Map(); this.id = 0; this.connecting = null;this.configOverrides=[]; }
  async configureReadOnly(config){this.stop();this.configOverrides=Object.entries(config).filter(([,value])=>value===false).flatMap(([key])=>['-c',key+'=false']);await this.connect();}
  async connect() {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const exe = this.executable||findCodex();
      if (!exe) throw new Error('未找到 Codex CLI，请先安装或打开 Codex 桌面应用');
      const child = this.child = this.spawnImpl(exe, [...this.configOverrides,'app-server', '--stdio'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let buffer = '';
      child.stderr.on('data', () => {});
      child.stdout.on('data', chunk => {
        buffer += chunk;
        if (buffer.length > 4 * 1024 * 1024) { child.kill(); return; }
        let at;
        while ((at = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
          let m; try { m = JSON.parse(line); } catch { continue; }
          if(m.method){
            if(m.id!==undefined)child.stdin.write(JSON.stringify({id:m.id,error:{code:-32601,message:'Read-only client: interactive grants and external tool requests are not supported'}})+'\n');
            else this.onNotification?.(m.method,m.params||{});
          }else{
            const p=this.pending.get(m.id);
            if(p){clearTimeout(p.timeout);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message||'Codex接口出错')):p.resolve(m.result);}
          }
        }
      });
      const failed = () => {
        if (this.child !== child) return;
        this.child = null; this.connecting = null;
        for (const p of this.pending.values()) { clearTimeout(p.timeout); p.reject(new Error('Codex 连接已关闭')); }
        this.pending.clear();
        this.onDisconnect?.();
      };
      child.on('error', failed); child.on('exit', failed); child.stdin.on('error', failed);
      await this.request('initialize', { clientInfo: { name: 'blob_pet_companion', title: 'Blob Pet Companion', version: '0.7.0' } });
      child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    })();
    try { await this.connecting; }
    catch (error) { this.stop(); throw error; }
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Codex 额度读取超时')); }, 20000);
      this.pending.set(id, { resolve, reject, timeout });
      try { this.child.stdin.write(JSON.stringify({ id, method, ...(params ? { params } : {}) }) + '\n'); }
      catch (e) { clearTimeout(timeout); this.pending.delete(id); reject(e); }
    });
  }
  async readLimits() { await this.connect(); return this.request('account/rateLimits/read'); }
  stop() {
    const child = this.child;
    this.child = null; this.connecting = null;
    for (const p of this.pending.values()) { clearTimeout(p.timeout); p.reject(new Error('Codex 连接已结束')); }
    this.pending.clear();
    child?.kill();
  }
}
module.exports = { CodexClient, findCodex };
