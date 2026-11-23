const { app, BrowserWindow, Menu, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setName('EmberDungeon');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.emberdungeon.game');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true,
    minWidth: 800,
    minHeight: 450,
    title: '餘燼地城',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devUrl = process.env.ELECTRON_DEV_URL;
  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('app://ember-dungeon/') ||
      (devUrl && url.startsWith(devUrl));
    if (!allowed) {
      event.preventDefault();
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.key === 'F11' || (input.alt && input.key === 'Enter'))
    ) {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

  win.loadURL(devUrl || 'app://ember-dungeon/index.html');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

    const distDir = path.resolve(__dirname, '..', 'dist');
    protocol.handle('app', async (request) => {
      let pathname;
      try {
        const reqUrl = new URL(request.url);
        pathname = decodeURIComponent(reqUrl.pathname || '/');
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
      }

      const relPath = pathname.replace(/^\/+/, '');
      const filePath = path.resolve(distDir, relPath);
      if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
        return new Response('Forbidden', { status: 403 });
      }

      try {
        const data = await fs.promises.readFile(filePath);
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': getMimeType(filePath),
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        if (err && (err.code === 'ENOENT' || err.code === 'EISDIR' || err.code === 'ENOTDIR')) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response('Internal Error', { status: 500 });
      }
    });

    createWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

