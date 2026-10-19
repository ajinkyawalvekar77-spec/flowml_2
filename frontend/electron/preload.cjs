const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  isOfflineMode: true,
  platform: process.platform,
  version: '2.0.0',
});
