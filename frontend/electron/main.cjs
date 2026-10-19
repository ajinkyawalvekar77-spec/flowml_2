const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;
let staticServer = null;

const PORT_FRONTEND = 5173;
const PORT_BACKEND = 8000;

// Simple, ultra-fast built-in HTTP static server for dist/ (fallback for offline mode)
function startStaticFileServer(callback) {
  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    callback();
    return;
  }

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
  };

  staticServer = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);

    // If file doesn't exist, serve index.html for SPA client-side routing
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error loading file');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(content, 'utf-8');
      }
    });
  });

  staticServer.listen(PORT_FRONTEND, '127.0.0.1', () => {
    console.log(`[FlowML Desktop] Serving built frontend on http://127.0.0.1:${PORT_FRONTEND}`);
    callback();
  });

  staticServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[FlowML Desktop] Port ${PORT_FRONTEND} already in use (dev server active).`);
    }
    callback();
  });
}

function checkPortListening(port, callback) {
  let called = false;
  const done = (val) => {
    if (!called) {
      called = true;
      callback(val);
    }
  };
  const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
    done(true);
  });
  req.on('error', () => done(false));
  req.setTimeout(1000, () => {
    req.abort();
    done(false);
  });
}

function checkBackendHealth(callback) {
  let called = false;
  const done = (val) => {
    if (!called) {
      called = true;
      callback(val);
    }
  };
  const req = http.get(`http://127.0.0.1:${PORT_BACKEND}/api/health`, (res) => {
    done(res.statusCode === 200);
  });
  req.on('error', () => done(false));
  req.setTimeout(1500, () => {
    req.abort();
    done(false);
  });
}

function startBackendIfNeeded(callback) {
  checkBackendHealth((isRunning) => {
    if (isRunning) {
      console.log('[FlowML Desktop] FastAPI backend is active on port 8000.');
      if (callback) callback();
      return;
    }

    console.log('[FlowML Desktop] Starting local FastAPI ML backend...');
    const backendDir = path.resolve(__dirname, '../../backend');
    const venvPython = path.join(backendDir, 'venv', 'bin', 'python');
    const systemPython = 'python3';
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : systemPython;

    try {
      backendProcess = spawn(
        pythonCmd,
        ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8000'],
        {
          cwd: backendDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            DEV_AUTH: '1',
            OFFLINE_MODE: '1',
            MPLCONFIGDIR: path.join(process.env.HOME || '/tmp', '.matplotlib'),
            STORAGE_ROOT: path.join(backendDir, 'storage'),
            FLOWML_STORAGE_DIR: path.join(backendDir, 'storage'),
          },
        }
      );

      backendProcess.on('error', (err) => {
        console.error('[FlowML Desktop] Failed to spawn backend:', err);
      });
    } catch (e) {
      console.error('[FlowML Desktop] Error launching backend:', e);
    }

    // Wait up to 3 seconds for backend to start
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      checkBackendHealth((healthy) => {
        if (healthy || attempts >= 8) {
          clearInterval(interval);
          if (callback) callback();
        }
      });
    }, 400);
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'FlowML Studio — Visual Machine Learning Pipeline Builder',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  // App Menu
  const template = [
    {
      label: 'FlowML Studio',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Local API Swagger Docs',
          click: async () => {
            await shell.openExternal('http://127.0.0.1:8000/docs');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Check frontend availability and load URL
  const targetUrl = `http://127.0.0.1:${PORT_FRONTEND}`;

  checkPortListening(PORT_FRONTEND, (isRunning) => {
    if (isRunning) {
      mainWindow.loadURL(targetUrl);
    } else {
      startStaticFileServer(() => {
        mainWindow.loadURL(targetUrl);
      });
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const dockIcon = path.join(__dirname, 'icon.png');
    if (fs.existsSync(dockIcon)) {
      app.dock.setIcon(dockIcon);
    }
  }

  startBackendIfNeeded(() => {
    createMainWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (_) {}
  }
  if (staticServer) {
    try {
      staticServer.close();
    } catch (_) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (_) {}
  }
  if (staticServer) {
    try {
      staticServer.close();
    } catch (_) {}
  }
});
