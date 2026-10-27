const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pet', {
  ready: () => ipcRenderer.invoke('pet:ready'),
  action: value => { if (['pet', 'drag-start', 'drag-end', 'menu'].includes(value)) ipcRenderer.send('pet:action', value); },
  onState: callback => ipcRenderer.on('pet:state', (_event, state) => callback(state)),
  onSettings: callback => ipcRenderer.on('pet:settings', (_event, value) => callback(value)),
  onGaze: callback => ipcRenderer.on('pet:gaze', (_event, value) => callback(value)),
  onVisibility: callback => ipcRenderer.on('pet:visibility', (_event, value) => callback(value)),
  stats: () => ipcRenderer.invoke('pet:stats-read'),
  companion: action => ipcRenderer.invoke('pet:companion-action', action),
  onStats: callback => ipcRenderer.on('pet:stats', (_event, value) => callback(value)),
  onNotice: callback => ipcRenderer.on('pet:notice', (_event, value) => callback(value)),
});
