const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API calls to backend server
  fetch: (endpoint, options = {}) => {
    const baseURL = 'http://localhost:3001';
    const url = `${baseURL}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('API call failed:', error);
      throw error;
    });
  },

  // Data management
  exportData: (backupPath) => ipcRenderer.invoke('export-data', backupPath),
  importData: () => ipcRenderer.invoke('import-data'),

  // Backup path settings
  getBackupPath: () => ipcRenderer.invoke('get-backup-path'),
  setBackupPath: (path) => ipcRenderer.invoke('set-backup-path', path),
  selectBackupPath: () => ipcRenderer.invoke('select-backup-path'),

  // Auto backup settings
  getAutoBackupSettings: () => ipcRenderer.invoke('get-auto-backup-settings'),
  saveAutoBackupSettings: (settings) => ipcRenderer.invoke('save-auto-backup-settings', settings),

  // 🆕 === منطق الخروج مع النافذة المخصصة (مُحسَّن) ===
  
  // لإرسال قرار المستخدم بشأن الإغلاق إلى الخلفية
  sendExitDecision: (decision) => ipcRenderer.send('exit-decision', decision),

  // 🔧 تعريف محسن للاستماع للأحداث
  onShouldShowBackupDialog: (callback) => {
    // نستخدم دالة مجهولة (anonymous function) لالتقاط الحدث وتمرير الباقي
    ipcRenderer.on('should-show-backup-dialog', (event, ...args) => callback(...args));
  },

  // لإزالة مستمع الأحداث عند الحاجة
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Legacy methods for backward compatibility
  saveData: (data) => Promise.resolve({ status: 'success' }),
  loadData: () => Promise.resolve({ status: 'success', data: {} }),
  log: (message) => console.log(`[RENDERER LOG]: ${message}`)
});