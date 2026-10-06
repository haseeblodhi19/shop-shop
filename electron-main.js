const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Run the Express server in-process (same process as Electron's main process)
// instead of forking a child process. child_process.fork() in a packaged
// Windows app can fail with ENOENT when the install path/exe name contains
// spaces (e.g. "ShopFlow POS.exe"), so requiring server.js directly avoids
// that whole class of problem and is simpler besides.
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      process.env.PORT = process.env.PORT || '3000';
      require(path.join(__dirname, 'server.js'));
      setTimeout(resolve, 600);
    } catch (error) {
      reject(error);
    }
  });
}

async function printHtml({ html, printerName = '' }) {
  if (!html) throw new Error('Nothing to print.');

  const printWindow = new BrowserWindow({
    show: false,
    width: 420,
    height: 800,
    webPreferences: { sandbox: true }
  });

  try {
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(resolve => setTimeout(resolve, 150));

    const printers = await printWindow.webContents.getPrintersAsync();
    const target = printerName
      ? printers.find(p => p.name === printerName)
      : printers.find(p => p.isDefault) || printers[0];

    if (!target) throw new Error('No printer is installed. Please install/select a printer in Windows first.');

    // Silent printing: Electron sends the job directly to the selected/default
    // printer without opening Chrome/Edge or a print-preview window.
    await new Promise((resolve, reject) => {
      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: target.name,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: 200000 }
      }, (success, reason) => success ? resolve() : reject(new Error(reason || 'Printer rejected the job.')));
    });

    return { printer: target.name };
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
  }
}

async function saveHtmlAsPdf({ html, suggestedName = 'report.pdf' }) {
  if (!html) throw new Error('Nothing to save.');
  const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF',
      defaultPath: suggestedName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, pdfBuffer);
    return { saved: true, filePath };
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL('http://127.0.0.1:3000');
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('direct-print', (_event, payload) => printHtml(payload));
ipcMain.handle('save-pdf', (_event, payload) => saveHtmlAsPdf(payload));
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
