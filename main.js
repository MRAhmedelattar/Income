const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn, fork } = require('child_process');
const fs = require('fs');
const http = require('http');
const log = require('electron-log');

let mainWindow;
let serverProcess;
let autoBackupInterval;
let isQuitting = false;
let logger;

// إعداد السجل
function setupLogger() {
    logger = log.create({ level: 'info' });
    logger.transports.file.level = 'info';
    logger.transports.console.level = 'info';
    // Log to: C:\Users\{user}\AppData\Roaming\{app name}\logs\main.log
}

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

// دالة لتنفيذ النسخ الاحتياطي
async function performBackup() {
    logger.info('Starting backup process...');
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(settingsContent);
        } catch (e) {
            logger.error('Could not read settings for backup path.');
            return { status: 'error', message: 'لم يتم العثور على مسار النسخ الاحتياطي في الإعدادات.' };
        }

        const backupPath = settings.backupPath;
        if (!backupPath) {
            logger.error('Backup path is not set.');
            return { status: 'error', message: 'لم يتم تحديد مجلد للنسخ الاحتياطي.' };
        }

        logger.info('Fetching data from the database...');
        const [
            funds,
            items,
            collections,
            revenues,
            users,
            signatures,
            deductions,
            budgetItems,
            budgetDeductions,
            config
        ] = await Promise.all([
            fetchFromAPI('funds'),
            fetchFromAPI('items'),
            fetchFromAPI('collections'),
            fetchFromAPI('revenues'),
            fetchFromAPI('users'),
            fetchFromAPI('signatures'),
            fetchFromAPI('deductions'),
            fetchFromAPI('budget-items'),
            fetchFromAPI('budget-deductions'),
            fetchFromAPI('config')
        ]);
        logger.info('Data fetched successfully.');

        const data = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                funds,
                items,
                collections,
                revenues,
                users,
                signatures,
                deductions,
                budgetItems,
                budgetDeductions,
                config
            }
        };

        const filename = `manual_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filePath = path.join(backupPath, filename);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logger.info(`Backup successful: ${filePath}`);
        return { status: 'success', path: filePath };
    } catch (error) {
        logger.error('Backup error:', error);
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
                const settingsContent = fs.readFileSync(settingsPath, 'utf8');
                settings = JSON.parse(settingsContent);
            } catch (e) {
                return;
            }

            if (settings.autoBackupEnabled) {
                const now = new Date();
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                if (currentTime === settings.autoBackupTime) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); 
                    performBackup();
                }
            }
        } catch (error) {
            logger.error('Error in auto backup scheduler:', error);
        }
    }, 60 * 1000);
}

// دالة لتحديد المسارات حسب البيئة
function getAppPaths() {
    const isDev = !app.isPackaged;
    const userDataPath = app.getPath('userData');

    if (isDev) {
        return {
            backendDir: path.join(__dirname, 'backend'),
            serverPath: path.join(__dirname, 'backend', 'server.js'),
            dbPath: path.join(__dirname, 'backend', 'prisma', 'database.db'),
            schemaPath: path.join(__dirname, 'backend', 'prisma', 'schema.prisma'),
        };
    } else {
        const resourcesPath = process.resourcesPath;
        const candidates = [
            path.join(resourcesPath, 'app.asar.unpacked', 'backend'),
            path.join(resourcesPath, 'backend'),
            path.join(resourcesPath, 'app', 'backend'),
        ];
        // pick the first existing candidate, otherwise fallback to first candidate
        const backendDir = candidates.find(p => fs.existsSync(p)) || candidates[0];
        return {
            backendDir,
            serverPath: path.join(backendDir, 'server.js'),
            dbPath: path.join(userDataPath, 'database.db'),
            schemaPath: path.join(backendDir, 'prisma', 'schema.prisma'),
        };
    }
}

function ensureDatabase() {
    const paths = getAppPaths();
    const isDev = !app.isPackaged;
    const userDbPath = paths.dbPath; // The correct AppData path

    if (!isDev && !fs.existsSync(userDbPath)) {
        logger.info(`Database not found at ${userDbPath}. Attempting to copy from package...`);
        try {
            const sourceDbPath = path.join(paths.backendDir, 'prisma', 'database.db');
            if (fs.existsSync(sourceDbPath)) {
                fs.copyFileSync(sourceDbPath, userDbPath);
                logger.info(`Successfully copied database from ${sourceDbPath} to ${userDbPath}.`);
                // Database is copied, so we skip migration and seeding.
            } else {
                throw new Error('Source database not found in package, proceeding with migration.');
            }
        } catch (copyError) {
            logger.warn(`Failed to copy database: ${copyError.message}. Running migration instead.`);
            // Fallback to creating DB via migration if copy fails
            try {
                const { spawnSync } = require('child_process');
                const prismaBin = path.join(paths.backendDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
                const migrateCmd = spawnSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
                    cwd: paths.backendDir,
                    env: {
                        ...process.env,
                        DATABASE_URL: `file:${userDbPath}`,
                        ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || '1'
                    },
                    encoding: 'utf8'
                });
                if (migrateCmd.status !== 0) {
                    logger.error('Prisma migrate deploy failed:', migrateCmd.stdout, migrateCmd.stderr);
                    throw new Error(`Migrate deploy failed: ${migrateCmd.stderr}`);
                } else {
                    logger.info('Prisma migrations applied (deploy)');
                }

                // Run the seed script to populate initial data
                logger.info('Running database seed script...');
                const seedPath = path.join(paths.backendDir, 'prisma', 'seed.js');
                if (fs.existsSync(seedPath)) {
                    // ... (seeding logic remains the same)
                } else {
                    logger.warn('Seed script not found at:', seedPath);
                }

            } catch (error) {
                logger.error('Failed to apply migrations manually:', error);
                if (fs.existsSync(userDbPath)) {
                    fs.unlinkSync(userDbPath);
                }
                throw new Error(`Failed to create database: ${error.message}`);
            }
        }
    } else if (!isDev) {
        logger.info(`Database already exists at ${userDbPath}. Skipping manual setup.`);
    }

    return userDbPath;
}

// تشغيل الخادم
function startServer() {
    return new Promise((resolve, reject) => {
    try {
      const paths = getAppPaths();
      const dbPath = ensureDatabase();

            logger.info('Attempting to start server with the following paths:');
            logger.info('serverPath:', paths.serverPath);
            logger.info('backendDir:', paths.backendDir);
            logger.info('dbPath:', dbPath);

            if (!fs.existsSync(paths.serverPath)) {
        logger.error('Server file not found:', paths.serverPath);
        return reject(new Error('Server file not found'));
      }

    // Use electron executable to run the server script
    const nodeExec = process.execPath;
    logger.info('Using exec path for node:', nodeExec);
      const env = {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: `file:${dbPath}`, // <- إزالة backtick الزائد
        PORT: '3001',
        ELECTRON_RUN_AS_NODE: '1'
      };

            // Use spawn so we can pick up output on stdout/stderr and avoid IPC complexity
            serverProcess = spawn(nodeExec, [paths.serverPath], {
                cwd: path.dirname(paths.serverPath),
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            logger.info('Spawned server process PID:', serverProcess.pid);

            serverProcess.on('error', (err) => {
        logger.error('Failed to start server process:', err);
        reject(err);
      });
            if (serverProcess.stdout) {
                serverProcess.stdout.on('data', d => {
                    logger.info('[server stdout] ' + d.toString());
                });
            }
            if (serverProcess.stderr) {
                serverProcess.stderr.on('data', d => {
                    logger.error('[server stderr] ' + d.toString());
                });
            }
      serverProcess.on('exit', code => logger.warn(`Server process exited with code ${code}`));
      resolve();
    } catch (err) {
      logger.error('startServer failed:', err);
      reject(err);
    }
  });
}

// التحقق من جاهزية الخادم
function checkServerReady(maxAttempts = 60, delayMs = 500) {
    // ping http://127.0.0.1:3001/api/health with retries
    return new Promise((resolve) => {
        const url = 'http://127.0.0.1:3001/api/health';
        let attempts = 0;

        const tryPing = () => {
            attempts += 1;
            const req = http.get(url, (res) => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    logger.info('Server is ready (health OK)');
                    resolve(true);
                } else {
                    if (attempts >= maxAttempts) {
                        logger.error(`Server health check failed after ${attempts} attempts, last status: ${res.statusCode}`);
                        resolve(false);
                    } else {
                        setTimeout(tryPing, delayMs);
                    }
                }
            });
            req.on('error', (err) => {
                logger.warn(`Health ping failed (attempt ${attempts}): ${err.message}`);
                if (attempts >= maxAttempts) {
                    resolve(false);
                } else {
                    setTimeout(tryPing, delayMs);
                }
            });
        };

        tryPing();
    });
}

async function createWindow() {
    console.log('=== Creating Main Window ===');

    // إعداد السجل
    setupLogger();

    try {
        // تشغيل الخادم
        logger.info('Starting server...');
        await startServer();
        logger.info('Server start command completed');

        // التحقق من جاهزية الخادم
        logger.info('Checking if server is ready...');
        const serverReady = await checkServerReady();

        if (!serverReady) {
            logger.error('❌ Server failed to start properly');
            dialog.showErrorBox(
                'خطأ في بدء التطبيق',
                'فشل في تشغيل الخادم الداخلي. يرجى إعادة تشغيل التطبيق.\n\nإذا استمرت المشكلة، تأكد من أن المنفذ 3001 غير مستخدم.'
            );
            app.quit();
            return;
        }

    } catch (error) {
        logger.error('❌ Error starting server:', error);
        dialog.showErrorBox(
            'خطأ في بدء التطبيق',
            `فشل في تشغيل الخادم:\n${error.message}\n\nيرجى إعادة تشغيل التطبيق.`
        );
        app.quit();
        return;
    }

    logger.info('Creating browser window...');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            enableRemoteModule: false,
            sandbox: true,
        },
    });

    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, 'build/index.html'),
        protocol: 'file:',
        slashes: true
    });

    logger.info('Loading URL:', startUrl);
    mainWindow.loadURL(startUrl);

    // فتح DevTools في وضع التطوير
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            logger.info('main.js: close event triggered, preventing default.');
            if (mainWindow && !mainWindow.isDestroyed()) {
                logger.info('main.js: Sending should-show-backup-dialog to renderer.');
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
    
    logger.info('✓ Window created successfully');
}

// IPC handlers for data management
ipcMain.handle('export-data', async (event, backupPath) => {
    logger.info('Manual export-data called, attempting to use performBackup logic...');
    try {
        // استخدام نفس منطق performBackup، ولكن مع اسم ملف مختلف
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(settingsContent);
        } catch (e) {
            logger.error('Could not read settings for backup path during manual export.');
            return { status: 'error', message: 'لم يتم العثور على مسار النسخ الاحتياطي في الإعدادات.' };
        }

        // تجاهل backupPath المُمر من الواجهة، ونستخدم المسار من الإعدادات ل consistency
        // أو نستخدم backupPath إذا كان مطلوبًا
        // const effectiveBackupPath = settings.backupPath || backupPath; // اختر الطريقة المناسبة
        // لتوحيد السلوك، نستخدم backupPath المُمر من الواجهة
        const effectiveBackupPath = backupPath;

        if (!effectiveBackupPath) {
            logger.error('Backup path is not set during manual export.');
            return { status: 'error', message: 'لم يتم تحديد مجلد للنسخ الاحتياطي.' };
        }

        logger.info('Fetching data from the database for manual export...');
        const [
            funds,
            items,
            collections,
            revenues,
            users,
            signatures,
            deductions,
            budgetItems,
            budgetDeductions,
            config
        ] = await Promise.all([
            fetchFromAPI('funds'),
            fetchFromAPI('items'),
            fetchFromAPI('collections'),
            fetchFromAPI('revenues'),
            fetchFromAPI('users'),
            fetchFromAPI('signatures'),
            fetchFromAPI('deductions'),
            fetchFromAPI('budget-items'),
            fetchFromAPI('budget-deductions'),
            fetchFromAPI('config')
        ]);
        logger.info('Data fetched successfully for manual export.');

        const data = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                funds,
                items,
                collections,
                revenues,
                users,
                signatures,
                deductions,
                budgetItems,
                budgetDeductions,
                config
            }
        };

        const filename = `manual_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filePath = path.join(effectiveBackupPath, filename);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logger.info(`Manual backup successful: ${filePath}`);
        return { status: 'success', path: filePath };
    } catch (error) {
        logger.error('Manual export error:', error);
        return { status: 'error', message: error.message };
    }
});
ipcMain.handle('import-data', async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled) {
            return { status: 'cancelled' };
        }

        const filePath = result.filePaths[0];
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        return { status: 'success', data };
    } catch (error) {
        logger.error('Import error:', error);
        return { status: 'error', message: error.message };
    }
});

// IPC handlers for backup path settings
ipcMain.handle('get-backup-path', async () => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(settingsContent);
        } catch (e) {}
        return { status: 'success', path: settings.backupPath || '' };
    } catch (error) {
        logger.error('Get backup path error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('set-backup-path', async (event, backupPath) => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            settings = JSON.parse(settingsContent);
        } catch (e) {}
        settings.backupPath = backupPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        return { status: 'success' };
    } catch (error) {
        logger.error('Set backup path error:', error);
        return { status: 'error', message: error.message };
    }
});

// IPC handlers for auto backup settings
ipcMain.handle('get-auto-backup-settings', async () => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let settings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
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
        logger.error('Get auto backup settings error:', error);
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('save-auto-backup-settings', async (event, settings) => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        let currentSettings = {};
        try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            currentSettings = JSON.parse(settingsContent);
        } catch (e) {}

        currentSettings.autoBackupTime = settings.time;
        currentSettings.autoBackupEnabled = settings.enabled;
        fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2), 'utf8');

        startAutoBackupScheduler();

        return { status: 'success' };
    } catch (error) {
        logger.error('Save auto backup settings error:', error);
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
        logger.error('Select backup path error:', error);
        return { status: 'error', message: error.message };
    }
});

// منطق الإغلاق مع النافذة المخصصة
async function quitApp() {
    isQuitting = true;
    logger.info('Quitting application...');
    if (autoBackupInterval) {
        clearInterval(autoBackupInterval);
    }
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('exit-decision', async (event, decision) => {
    switch (decision) {
        case 'backup-and-quit':
            const backupResult = await performBackup();
            if (backupResult.status === 'success') {
                logger.info('Backup on exit successful. Quitting app.');
            } else {
                dialog.showErrorBox('خطأ في النسخ الاحتياطي', `فشل إنشاء النسخة الاحتياطية: ${backupResult.message}\nسيتم إغلاق البرنامج على أي حال.`);
                logger.error('Backup on exit failed:', backupResult.message);
            }
            quitApp();
            break;

        case 'quit':
            logger.info('User chose to quit without backup.');
            quitApp();
            break;

        case 'cancel':
            logger.info('User cancelled the shutdown.');
            isQuitting = false;
            break;
    }
});

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
    if (serverProcess) {
        serverProcess.kill();
    }
});