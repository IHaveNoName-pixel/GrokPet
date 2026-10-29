'use strict';
function createStartup(app, executable, root) {
  const options = {name:'BlobPetStudy', path:executable, args:app.isPackaged ? [] : ['"' + root + '"']};
  return {
    read() {
      const s = app.getLoginItemSettings({path:options.path,args:options.args});
      return {registered:!!s.openAtLogin,enabled:!!s.openAtLogin && s.executableWillLaunchAtLogin !== false};
    },
    set(enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('开机启动必须是布尔值');
      app.setLoginItemSettings({...options,openAtLogin:enabled,enabled});
      return this.read();
    },
  };
}
module.exports = {createStartup};
