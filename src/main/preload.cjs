const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded successfully');
console.log('contextBridge available:', !!contextBridge);
console.log('ipcRenderer available:', !!ipcRenderer);

// 在渲染进程中显示日志
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script: DOMContentLoaded event fired');
  console.log('Preload script: window.electronAPI will be available');
});

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 设置管理
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // 提示词管理
  getPrompts: () => ipcRenderer.invoke('get-prompts'),
  savePrompts: (prompts) => ipcRenderer.invoke('save-prompts', prompts),
  
  // 窗口控制
  togglePinWindow: (shouldPin) => ipcRenderer.send('toggle-pin-window', shouldPin),
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  // 数据导入导出
  exportData: (options) => ipcRenderer.invoke('export-data', options),
  importData: (options) => ipcRenderer.invoke('import-data', options),
  
  // 应用更新和信息
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 数据库相关API
  getDatabaseStatus: () => ipcRenderer.invoke('get-database-status'),
  initializeDatabase: () => ipcRenderer.invoke('initialize-database'),
  getMigrationStatus: () => ipcRenderer.invoke('db-get-migration-status'),
  
  // 数据库重置API
  clearAllData: () => ipcRenderer.invoke('db-clear-all-data'),
  resetToDefaults: (language) => ipcRenderer.invoke('db-reset-to-defaults', language),
  
  // 通用IPC调用方法
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // OAuth 回调监听
  onOAuthCallback: (callback) => {
    ipcRenderer.on('oauth-callback', (event, data) => {
      callback(data);
    });
    // 返回清理函数
    return () => {
      ipcRenderer.removeAllListeners('oauth-callback');
    };
  },
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.send('open-external', url)
}); 

console.log('electronAPI exposed to renderer process');