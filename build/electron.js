const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const http = require('http');

let mainWindow;
let serverProcess;
let autoBackupInterval;
let isQuitting = false;

// Helper function to fetch data from the local API
function fetchFromAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:3001/api/${endpoint}`, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse API response.'));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`API request failed for ${endpoint}: ${e.message}`));
        });
    });
}

// دالة لتنفيذ النسخ الاحتياطي (منفصلة لتجنب تكرار الكود)
async function performBackup() {
    console.log('Starting backup process...');
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = await fs.readFile(settingsPath, 'utf8');
            settings = JSON.parse(settingsContent);
        } catch (e) {
            console.error('Could not read settings for backup path.');
            return { status: 'error', message: 'لم يتم العثور على مسار النسخ الاحتياطي في الإعدادات.' };
        }

        const backupPath = settings.backupPath;
        if (!backupPath) {
            console.error('Backup path is not set.');
            return { status: 'error', message: 'لم يتم تحديد مجلد للنسخ الاحتياطي.' };
        }

        // مسار قاعدة البيانات
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'database.db');

        // التحقق من وجود ملف قاعدة البيانات
        try {
            await fs.access(dbPath);
        } catch (e) {
            console.error('Database file not found:', dbPath);
            return { status: 'error', message: 'ملف قاعدة البيانات غير موجود.' };
        }

        // إنشاء اسم الملف الاحتياطي
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const filename = `backup_${timestamp}.db`;
        const filePath = path.join(backupPath, filename);

        // نسخ ملف قاعدة البيانات
        const fsSync = require('fs');
        fsSync.copyFileSync(dbPath, filePath);

        console.log(`Backup successful: ${filePath}`);
        return { status: 'success', path: filePath };
    } catch (error) {
        console.error('Backup error:', error);
        return { status: 'error', message: error.message };
    }
}

// دالة لبدء أو إعادة تشغيل المُجدول
function startAutoBackupScheduler() {
    if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
    }

    autoBackupInterval = setInterval(async () => {
        try {
            const settingsPath = path.join(app.getPath('userData'), 'settings.json');
            let settings = {};
            try {
                const settingsContent = await fs.readFile(settingsPath, 'utf8');
                settings = JSON.parse(settingsContent);
            } catch (e) {
                return;
            }

            if (settings.autoBackupEnabled) {
                const now = new Date();
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                if (currentTime === settings.autoBackupTime) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); 
                    performBackup(); // استدعاء النسخ التلقائي
                }
            }
        } catch (error) {
            console.error('Error in auto backup scheduler:', error);
        }
    }, 60 * 1000);
}

// تم تصحيح المسار هنا
function startServer() {
  try {
    let serverPath;
    // determine backend path similar to main.js
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      serverPath = path.join(__dirname, '..', 'backend', 'server.js');
    } else {
      const resourcesPath = process.resourcesPath;
      const candidates = [
        path.join(resourcesPath, 'app.asar.unpacked', 'backend', 'server.js'),
        path.join(resourcesPath, 'backend', 'server.js'),
        path.join(resourcesPath, 'app', 'backend', 'server.js'),
      ];
      serverPath = candidates.find(p => require('fs').existsSync(p)) || candidates[0];
    }

    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'database.db');

    const nodeExec = process.execPath;
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: `file:${dbPath}`,
      PORT: '3001',
      ELECTRON_RUN_AS_NODE: '1'
    };

    serverProcess = spawn(nodeExec, [serverPath], {
      cwd: path.dirname(serverPath),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (d) => console.log(`[server stdout] ${d.toString()}`));
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (d) => console.error(`[server stderr] ${d.toString()}`));
    }

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
    });

    console.log('Server process started successfully');
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

// checks backend health endpoint before loading window
function checkServerReady(maxAttempts = 60, delayMs = 500) {
  return new Promise((resolve) => {
    const url = 'http://127.0.0.1:3001/api/health';
    let attempts = 0;
    const tryPing = () => {
      attempts += 1;
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Server is ready (health OK)');
          resolve(true);
        } else {
          if (attempts >= maxAttempts) {
            console.error(`Server health check failed after ${attempts} attempts, status: ${res.statusCode}`);
            resolve(false);
          } else {
            setTimeout(tryPing, delayMs);
          }
        }
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) resolve(false);
        else setTimeout(tryPing, delayMs);
      });
    };
    tryPing();
  });
}

async function createWindow() {
  await startServer();

  const serverReady = await checkServerReady(80, 500);
  if (!serverReady) {
    console.error('Server failed to start. Aborting window creation.');
    dialog.showErrorBox('خطأ في بدء التطبيق', 'فشل في تشغيل الخادم الداخلي. يرجى التحقق من السجلات وإعادة التشغيل.');
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js'),
      webSecurity: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  });

  mainWindow.loadURL(startUrl);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      console.log('electron.js: close event triggered, preventing default.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('electron.js: Sending should-show-backup-dialog to renderer.');
        mainWindow.webContents.send('should-show-backup-dialog');
      }
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

// IPC handlers for data management
ipcMain.handle('export-data', async (event, backupPath) => {
  try {
    // مسار قاعدة البيانات
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'database.db');

    // التحقق من وجود ملف قاعدة البيانات
    try {
      await fs.access(dbPath);
    } catch (e) {
      console.error('Database file not found:', dbPath);
      return { status: 'error', message: 'ملف قاعدة البيانات غير موجود.' };
    }

    // إنشاء اسم الملف الاحتياطي
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `backup_${timestamp}.db`;
    const filePath = path.join(backupPath, filename);

    // نسخ ملف قاعدة البيانات
    const fsSync = require('fs');
    fsSync.copyFileSync(dbPath, filePath);

    console.log(`Export successful: ${filePath}`);
    return { status: 'success', path: filePath };
  } catch (error) {
    console.error('Export error:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('import-data', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'اختر ملف قاعدة البيانات للاسترداد'
    });

    if (result.canceled) {
      return { status: 'cancelled' };
    }

    const selectedFilePath = result.filePaths[0];

    // التحقق من أن الملف بصيغة .db
    if (!selectedFilePath.toLowerCase().endsWith('.db')) {
      return { status: 'error', message: 'يجب اختيار ملف بصيغة .db فقط.' };
    }

    // التحقق من حجم الملف (ليس فارغاً)
    const stats = await fs.stat(selectedFilePath);
    if (stats.size === 0) {
      return { status: 'error', message: 'الملف المختار فارغ.' };
    }

    // مسار قاعدة البيانات الحالية
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'database.db');

    // إغلاق اتصال SQLite إذا كان مفتوحاً (إيقاف الخادم)
    if (serverProcess) {
      serverProcess.kill();
      // انتظار قليل للتأكد من إغلاق الاتصال
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // استبدال ملف قاعدة البيانات
    const fsSync = require('fs');
    fsSync.copyFileSync(selectedFilePath, dbPath);

    return { status: 'success' };
  } catch (error) {
    console.error('Import error:', error);
    return { status: 'error', message: error.message };
  }
});

// IPC handlers for backup path settings
ipcMain.handle('get-backup-path', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(settingsContent);
    } catch (e) {}
    return { status: 'success', path: settings.backupPath || '' };
  } catch (error) {
    console.error('Get backup path error:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('set-backup-path', async (event, backupPath) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(settingsContent);
    } catch (e) {}
    settings.backupPath = backupPath;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return { status: 'success' };
  } catch (error) {
    console.error('Set backup path error:', error);
    return { status: 'error', message: error.message };
  }
});

// IPC handlers for auto backup settings
ipcMain.handle('get-auto-backup-settings', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      settings = JSON.parse(settingsContent);
    } catch (e) {}
    return {
      status: 'success',
      settings: {
        time: settings.autoBackupTime || '02:00',
        enabled: settings.autoBackupEnabled || false
      }
    };
  } catch (error) {
    console.error('Get auto backup settings error:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('save-auto-backup-settings', async (event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let currentSettings = {};
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      currentSettings = JSON.parse(settingsContent);
    } catch (e) {}

    currentSettings.autoBackupTime = settings.time;
    currentSettings.autoBackupEnabled = settings.enabled;
    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2), 'utf8');

    startAutoBackupScheduler();

    return { status: 'success' };
  } catch (error) {
    console.error('Save auto backup settings error:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('select-backup-path', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'اختر مجلد النسخ الاحتياطي'
    });

    if (result.canceled) {
      return { status: 'cancelled' };
    }

    const selectedPath = result.filePaths[0];
    return { status: 'success', path: selectedPath };
  } catch (error) {
    console.error('Select backup path error:', error);
    return { status: 'error', message: error.message };
  }
});

// ===================================
// === 🆕 منطق الإغلاق مع النافذة المخصصة (مُحسَّن) ===
// ===================================

// هذه الدالة ستقوم بعملية الإغلاق الفعلية
async function quitApp() {
    isQuitting = true;
    console.log('Quitting application...');
    if (serverProcess) {
        serverProcess.kill();
    }
    if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
    }
    app.quit();
}

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// نستمع لرد المستخدم من الواجهة الأمامية
ipcMain.on('exit-decision', async (event, decision) => {
    switch (decision) {
        case 'backup-and-quit':
            const backupResult = await performBackup();
            if (backupResult.status === 'success') {
                console.log('Backup on exit successful. Quitting app.');
            }
            else {
                dialog.showErrorBox('خطأ في النسخ الاحتياطي', `فشل إنشاء النسخة الاحتياطية: ${backupResult.message}\nسيتم إغلاق البرنامج على أي حال.`);
                console.error('Backup on exit failed:', backupResult.message);
            }
            quitApp();
            break;

        case 'quit':
            console.log('User chose to quit without backup.');
            quitApp();
            break;

        case 'cancel':
            console.log('User cancelled the shutdown.');
            isQuitting = false; // إعادة تعيين الحالة
            break;
    }
});

// ===================================
// === بقيّة أحداث التطبيق ===
// ===================================

app.on('ready', () => {
  createWindow();
  startAutoBackupScheduler();
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
    isQuitting = true;
    if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
    }
});
