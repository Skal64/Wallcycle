const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

const wallpapersDir = path.join(app.getPath('userData'), 'DownloadedWallpapers');
if (!fs.existsSync(wallpapersDir)) {
    fs.mkdirSync(wallpapersDir, { recursive: true });
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 500,
        frame: false,
        backgroundColor: '#0b0d11',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    ipcMain.on('window-minimize', () => mainWindow.minimize());
    
    ipcMain.on('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    ipcMain.on('window-close', () => mainWindow.close());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.exit();
});

ipcMain.handle('open-files-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
        ]
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
});

// Handle Pixabay requests using native fetch and standard options
ipcMain.handle('fetch-pixabay-wallpapers', async (event, payload) => {
    const query = (typeof payload === 'object' && payload !== null) ? payload.query : payload;
    const resolution = (typeof payload === 'object' && payload !== null) ? payload.resolution : 'any';
    const page = (typeof payload === 'object' && payload !== null && payload.page) ? payload.page : 1;
    const apiKey = (typeof payload === 'object' && payload !== null && payload.apiKey) ? payload.apiKey : '47844026-6a5661b626d1b28d70df890b2';
    
    if (!apiKey) {
        return { error: 'NO_API_KEY' };
    }
    
    let url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query || 'wallpaper')}&image_type=photo&orientation=horizontal&per_page=20&page=${page}&safesearch=true`;

    if (resolution === '3840x2160' || resolution === '4k') {
        url += `&min_width=3840&min_height=2160`;
    } else if (resolution === '2560x1440' || resolution === 'qhd') {
        url += `&min_width=2560&min_height=1440`;
    } else if (resolution === '1920x1080' || resolution === 'fhd') {
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

// Handle Wallhaven API searches using native fetch
ipcMain.handle('fetch-wallhaven-wallpapers', async (event, payload) => {
    const query = (typeof payload === 'object' && payload !== null) ? payload.query : payload;
    const resolution = (typeof payload === 'object' && payload !== null) ? payload.resolution : 'any';
    const page = (typeof payload === 'object' && payload !== null && payload.page) ? payload.page : 1;
    const apiKey = (typeof payload === 'object' && payload !== null) ? payload.apiKey : '';
    
    let url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(query || '')}&page=${page}&purity=100`;

    if (apiKey) {
        url += `&apikey=${apiKey}`;
    }

    if (resolution === '3840x2160' || resolution === '4k') {
        url += `&resolutions=3840x2160`;
    } else if (resolution === '2560x1440' || resolution === 'qhd') {
        url += `&resolutions=2560x1440`;
    } else if (resolution === '1920x1080' || resolution === 'fhd') {
        url += `&resolutions=1920x1080`;
    } else if (resolution === '1024x768') {
        url += `&resolutions=1024x768`;
    }

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Electron-Wallpaper-Manager' }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Wallhaven Fetch Error:', error);
        return { data: [] };
    }
});

ipcMain.handle('download-and-save-image', async (event, payload) => {
    try {
        const imageUrl = typeof payload === 'object' && payload !== null ? payload.imageUrl : payload;
        const photoName = typeof payload === 'object' && payload !== null && payload.photoName ? payload.photoName : 'wallpaper';

        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        const buffer = await response.arrayBuffer();

        const safeName = photoName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        let ext = '.jpg';
        try {
            const parsedUrlPath = new URL(imageUrl).pathname;
            const extensionMatch = path.extname(parsedUrlPath);
            if (extensionMatch) ext = extensionMatch;
        } catch (e) {
            // fallback to .jpg if URL parsing fails
        }

        const fileName = `${Date.now()}_${safeName}${ext}`;
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
        
        if (!fs.existsSync(resolvedPath)) {
            resolve(false);
            return;
        }

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