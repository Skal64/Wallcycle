const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

const wallpapersDir = path.join(app.getPath('userData'), 'DownloadedWallpapers');
if (!fs.existsSync(wallpapersDir)) {
    fs.mkdirSync(wallpapersDir, { recursive: true });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    backgroundColor: '#0b0d11',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.close());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.exit();
});

ipcMain.handle('open-files-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  return result.filePaths;
});

// Handle Pixabay requests using the user-provided API key safely passed from renderer
ipcMain.handle('fetch-pixabay-wallpapers', async (event, payload) => {
    const query = (typeof payload === 'object' && payload !== null) ? payload.query : payload;
    const resolution = (typeof payload === 'object' && payload !== null) ? payload.resolution : 'any';
    const page = (typeof payload === 'object' && payload !== null && payload.page) ? payload.page : 1;
    const apiKey = (typeof payload === 'object' && payload !== null) ? payload.apiKey : '';
    
    if (!apiKey) {
        return { error: 'NO_API_KEY' };
    }
    
    let url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query || 'wallpaper')}&image_type=photo&orientation=horizontal&per_page=12&page=${page}`;

    if (resolution === '4k') {
        url += `&min_width=3840&min_height=2160`;
    } else if (resolution === 'qhd') {
        url += `&min_width=2560&min_height=1440`;
    } else if (resolution === 'fhd') {
        url += `&min_width=1920&min_height=1080`;
    } else if (resolution === '1024x768') {
        url += `&min_width=1024&min_height=768`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Pixabay Fetch Error:', error);
        return { hits: [] };
    }
});

ipcMain.handle('download-and-save-image', async (event, payload) => {
    try {
        const imageUrl = typeof payload === 'object' ? payload.imageUrl : payload;
        const photoName = typeof payload === 'object' ? payload.photoName : 'wallpaper';

        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();

        const safeName = photoName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${Date.now()}_${safeName}.jpg`;
        const filePath = path.join(wallpapersDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(buffer));
        return filePath;
    } catch (error) {
        console.error('Download and save error:', error);
        return null;
    }
});

ipcMain.handle('set-wallpaper', async (event, imagePath) => {
  return new Promise((resolve) => {
    const resolvedPath = path.resolve(imagePath);
    
    const psScript = `
      Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class W { [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int SystemParametersInfo(int u, int p, string v, int f); }'
      [W]::SystemParametersInfo(20, 0, '${resolvedPath.replace(/'/g, "''")}', 3)
    `;

    const buffer = Buffer.from(psScript, 'utf16le');
    const encodedCommand = buffer.toString('base64');

    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encodedCommand], { windowsHide: true }, (error) => {
      if (error) {
        console.error('Wallpaper error:', error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
});