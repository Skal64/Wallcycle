const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    openFilesDialog: () => ipcRenderer.invoke('open-files-dialog'),
    fetchPixabayWallpapers: (payload) => ipcRenderer.invoke('fetch-pixabay-wallpapers', payload),
    downloadAndSaveImage: (payload) => ipcRenderer.invoke('download-and-save-image', payload),
    setWallpaper: (imagePath) => ipcRenderer.invoke('set-wallpaper', imagePath),
    setZoomFactor: (zoomFactor) => ipcRenderer.invoke('set-zoom-factor', zoomFactor), // optional if handled via webFrame
});