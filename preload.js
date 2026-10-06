const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  directPrint: (payload) => ipcRenderer.invoke('direct-print', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  savePdf: (payload) => ipcRenderer.invoke('save-pdf', payload)
});
