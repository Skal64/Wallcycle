const { ipcRenderer, webFrame } = require('electron');

// Enable dynamic zoom controls (Ctrl + +, Ctrl + -, Ctrl + 0)
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        let currentZoom = webFrame.getZoomFactor();
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            webFrame.setZoomFactor(Math.min(currentZoom + 0.1, 3.0)); // Max zoom 300%
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            webFrame.setZoomFactor(Math.max(currentZoom - 0.1, 0.5)); // Min zoom 50%
        } else if (e.key === '0') {
            e.preventDefault();
            webFrame.setZoomFactor(1.0); // Reset zoom
        }
    }
});

document.getElementById('minBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));

const selectImagesBtn = document.getElementById('selectImagesBtn');
const statusText = document.getElementById('statusText');
const imageGrid = document.getElementById('imageGrid');
const allWallpapersBtn = document.getElementById('allWallpapersBtn');
const collectionList = document.getElementById('collectionList');
const newCollectionBtn = document.getElementById('newCollectionBtn');
const newCollectionContainer = document.getElementById('newCollectionContainer');
const newCollectionInput = document.getElementById('newCollectionInput');
const saveCollectionBtn = document.getElementById('saveCollectionBtn');
const collectionTitle = document.getElementById('collectionTitle');

// Settings & Context menu elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const themeSelect = document.getElementById('themeSelect');
const pixabayKeyInput = document.getElementById('pixabayKeyInput');
const collectionContextMenu = document.getElementById('collectionContextMenu');
const ctxRenameCol = document.getElementById('ctxRenameCol');
const ctxDeleteCol = document.getElementById('ctxDeleteCol');

let allImages = JSON.parse(localStorage.getItem('wallcycle_images')) || [];
let collections = JSON.parse(localStorage.getItem('wallcycle_collections')) || {};
let imageNames = JSON.parse(localStorage.getItem('wallcycle_names')) || {};
let currentTheme = localStorage.getItem('wallcycle_theme') || 'dark';
let pixabayApiKey = localStorage.getItem('wallcycle_pixabay_key') || '';
let activeCollection = 'all';

let currentSearchQuery = '';
let currentSearchResolution = 'any';
let searchPage = 1;

let draggedPath = null;
let draggedSourceCol = null;
let contextTargetColId = null;

// Initialize Theme & UI
document.documentElement.setAttribute('data-theme', currentTheme);
themeSelect.value = currentTheme;
if (pixabayKeyInput) pixabayKeyInput.value = pixabayApiKey;
renderCollections();
updateDisplay();

// Settings Controls
openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('open');
    void settingsModal.offsetHeight;
    if (pixabayKeyInput) pixabayKeyInput.focus();
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('open'));
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('open');
});

themeSelect.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wallcycle_theme', currentTheme);
});

if (pixabayKeyInput) {
    pixabayKeyInput.addEventListener('input', (e) => {
        pixabayApiKey = e.target.value.trim();
        localStorage.setItem('wallcycle_pixabay_key', pixabayApiKey);
    });
}

// Toggle Collection Input Form
newCollectionBtn.addEventListener('click', () => {
    const isHidden = newCollectionContainer.style.display === 'none';
    newCollectionContainer.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) newCollectionInput.focus();
});

function handleCreateCollection() {
    const name = newCollectionInput.value.trim();
    if (name) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (!collections[id]) {
            collections[id] = { name: name, images: [] };
            saveData();
            newCollectionInput.value = '';
            newCollectionContainer.style.display = 'none';
            renderCollections();
            switchCollection(id);
        } else {
            alert('Collection already exists.');
        }
    }
}

saveCollectionBtn.addEventListener('click', handleCreateCollection);
newCollectionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCreateCollection();
});

function saveData() {
    localStorage.setItem('wallcycle_images', JSON.stringify(allImages));
    localStorage.setItem('wallcycle_collections', JSON.stringify(collections));
    localStorage.setItem('wallcycle_names', JSON.stringify(imageNames));
}

function switchCollection(id) {
    activeCollection = id;
    
    if (allWallpapersBtn) {
        if (id === 'all') {
            allWallpapersBtn.classList.add('active');
        } else {
            allWallpapersBtn.classList.remove('active');
        }
    }

    if (id === 'all') {
        collectionTitle.innerText = 'All Wallpapers';
    } else if (collections[id]) {
        collectionTitle.innerText = collections[id].name;
    }

    renderCollections();
    updateDisplay();
}

function renderCollections() {
    collectionList.innerHTML = '';

    Object.keys(collections).forEach(id => {
        const col = collections[id];
        const li = document.createElement('li');
        li.className = `collection-item ${activeCollection === id ? 'active' : ''}`;
        li.dataset.id = id;
        li.innerText = col.name;
        collectionList.appendChild(li);
    });
}

if (allWallpapersBtn) {
    allWallpapersBtn.addEventListener('click', () => switchCollection('all'));
}

collectionList.addEventListener('click', (e) => {
    const item = e.target.closest('.collection-item');
    if (item) {
        switchCollection(item.dataset.id);
    }
});

collectionList.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.collection-item');
    if (item) {
        e.preventDefault();
        contextTargetColId = item.dataset.id;
        collectionContextMenu.style.display = 'flex';
        collectionContextMenu.style.top = `${e.clientY}px`;
        collectionContextMenu.style.left = `${e.clientX}px`;
    }
});

ctxRenameCol.addEventListener('click', () => {
    collectionContextMenu.style.display = 'none';
    if (!contextTargetColId || !collections[contextTargetColId]) return;

    const currentName = collections[contextTargetColId].name;
    const newName = prompt('Rename collection:', currentName);
    if (newName && newName.trim()) {
        collections[contextTargetColId].name = newName.trim();
        saveData();
        renderCollections();
        if (activeCollection === contextTargetColId) {
            collectionTitle.innerText = newName.trim();
        }
    }
});

ctxDeleteCol.addEventListener('click', () => {
    collectionContextMenu.style.display = 'none';
    if (!contextTargetColId || !collections[contextTargetColId]) return;

    if (confirm(`Delete collection "${collections[contextTargetColId].name}"? (Your wallpapers will remain in All Wallpapers)`)) {
        delete collections[contextTargetColId];
        saveData();
        if (activeCollection === contextTargetColId) {
            switchCollection('all');
        } else {
            renderCollections();
        }
    }
});

collectionList.addEventListener('dragover', (e) => e.preventDefault());

collectionList.addEventListener('dragenter', (e) => {
    const item = e.target.closest('.collection-item');
    if (item && item.dataset.id !== activeCollection) {
        item.classList.add('drag-over');
    }
});

collectionList.addEventListener('dragleave', (e) => {
    const item = e.target.closest('.collection-item');
    if (item) item.classList.remove('drag-over');
});

collectionList.addEventListener('drop', (e) => {
    e.preventDefault();
    const item = e.target.closest('.collection-item');
    if (item) {
        item.classList.remove('drag-over');
        const targetColId = item.dataset.id;
        if (targetColId === activeCollection) return;

        const imagePath = draggedPath;
        const sourceColId = draggedSourceCol;

        if (!imagePath) return;

        if (targetColId !== 'all' && collections[targetColId]) {
            if (!collections[targetColId].images.includes(imagePath)) {
                collections[targetColId].images.push(imagePath);
            }
        }

        if (sourceColId && sourceColId !== 'all' && collections[sourceColId]) {
            collections[sourceColId].images = collections[sourceColId].images.filter(p => p !== imagePath);
        }

        saveData();
        updateDisplay();
    }
});

function updateDisplay() {
    let imagesToDisplay = allImages;
    if (activeCollection !== 'all' && collections[activeCollection]) {
        imagesToDisplay = allImages.filter(img => collections[activeCollection].images.includes(img));
    }
    displayImages(imagesToDisplay);
}

async function handleImageSelection() {
    const filePaths = await ipcRenderer.invoke('open-files-dialog');
    if (filePaths && filePaths.length > 0) {
        filePaths.forEach(p => {
            if (!allImages.includes(p)) allImages.push(p);
        });
        saveData();
        updateDisplay();
    }
}

selectImagesBtn.addEventListener('click', handleImageSelection);

function displayImages(images) {
    imageGrid.innerHTML = '';

    if (allImages.length === 0) {
        imageGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖼️</div>
                <h3>No wallpapers added</h3>
                <p>Click "Select Images" to choose your favorite wallpapers.</p>
                <button id="emptySelectBtn" class="btn secondary-btn">Select Images</button>
            </div>
        `;
        document.getElementById('emptySelectBtn').addEventListener('click', handleImageSelection);
        statusText.innerText = 'No images selected';
        return;
    }

    if (images.length === 0) {
        imageGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>Collection is empty</h3>
                <p>Drag wallpapers here from "All Wallpapers" or other collections.</p>
            </div>
        `;
        statusText.innerText = `0 images in view (${allImages.length} total)`;
        return;
    }

    statusText.innerText = `${images.length} images shown (${allImages.length} total)`;

    images.forEach((imgPath) => {
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.draggable = true;
        card.dataset.path = imgPath;
        card.dataset.collection = activeCollection;

        const defaultFileName = imgPath.split('\\').pop().split('/').pop();
        const displayName = imageNames[imgPath] || defaultFileName;
        const safePath = imgPath.replace(/\\/g, '/');
        const imgSrc = `file://${safePath}`;
        const deleteLabel = activeCollection === 'all' ? '🗑️ Delete from App' : '🗑️ Remove from Collection';

        card.innerHTML = `
            <div class="thumb-img-wrapper" data-path="${imgPath}">
                <img class="thumb-img" src="${imgSrc}" loading="lazy">
                <button class="card-menu-btn" data-path="${imgPath}" title="Options">⋮</button>
                <div class="card-dropdown" id="dropdown-${CSS.escape(imgPath)}">
                    <button class="dropdown-item rename-btn" data-path="${imgPath}">✏️ Rename</button>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item delete delete-btn" data-path="${imgPath}">${deleteLabel}</button>
                </div>
            </div>
            <div class="thumb-name" title="${displayName}">${displayName}</div>
        `;

        imageGrid.appendChild(card);
    });
}

imageGrid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.thumb-card');
    if (card) {
        draggedPath = card.dataset.path;
        draggedSourceCol = card.dataset.collection;
        e.dataTransfer.setData('text/plain', draggedPath);
    }
});

imageGrid.addEventListener('dragend', () => {
    draggedPath = null;
    draggedSourceCol = null;
});

imageGrid.addEventListener('click', async (e) => {
    const menuBtn = e.target.closest('.card-menu-btn');
    if (menuBtn) {
        e.stopPropagation();
        const path = menuBtn.dataset.path;
        const dropdown = document.getElementById(`dropdown-${CSS.escape(path)}`);
        
        document.querySelectorAll('.card-dropdown').forEach(d => {
            if (d !== dropdown) d.classList.remove('show');
        });
        dropdown.classList.toggle('show');
        return;
    }

    const renameBtn = e.target.closest('.rename-btn');
    if (renameBtn) {
        e.stopPropagation();
        const path = renameBtn.dataset.path;
        const currentName = imageNames[path] || path.split('\\').pop().split('/').pop();
        const newName = prompt('Enter a custom display name:', currentName);
        if (newName && newName.trim()) {
            imageNames[path] = newName.trim();
            saveData();
            updateDisplay();
        }
        return;
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        e.stopPropagation();
        const path = deleteBtn.dataset.path;
        
        if (activeCollection === 'all') {
            allImages = allImages.filter(p => p !== path);
            delete imageNames[path];
            Object.keys(collections).forEach(colId => {
                collections[colId].images = collections[colId].images.filter(p => p !== path);
            });
        } else {
            if (collections[activeCollection]) {
                collections[activeCollection].images = collections[activeCollection].images.filter(p => p !== path);
            }
        }

        saveData();
        updateDisplay();
        return;
    }

    const thumbWrapper = e.target.closest('.thumb-img-wrapper');
    if (thumbWrapper && !e.target.closest('.card-dropdown')) {
        const path = thumbWrapper.dataset.path;
        const card = thumbWrapper.closest('.thumb-card');

        if (card.classList.contains('loading')) return;

        card.classList.add('loading');
        statusText.innerText = 'Applying wallpaper...';

        try {
            const success = await ipcRenderer.invoke('set-wallpaper', path);
            if (success) {
                document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active', 'loading'));
                card.classList.add('active');
                statusText.innerText = 'Wallpaper applied successfully!';
            } else {
                card.classList.remove('loading');
                statusText.innerText = 'Failed to apply wallpaper.';
            }
        } catch (err) {
            card.classList.remove('loading');
            statusText.innerText = 'Error applying wallpaper.';
        }
    }
});

window.addEventListener('click', () => {
    document.querySelectorAll('.card-dropdown').forEach(d => {
        if (d !== collectionContextMenu) d.classList.remove('show');
    });
    collectionContextMenu.style.display = 'none';
});

// --- ONLINE WALLPAPER SEARCH FEATURE --- 

document.addEventListener('DOMContentLoaded', () => {
    const openSearchBtn = document.getElementById('openSearchBtn');
    if (openSearchBtn) {
        openSearchBtn.addEventListener('click', () => {
            const searchModal = document.getElementById('searchModal');
            if (searchModal) searchModal.style.display = 'flex';
        });
    }
});

const searchModal = document.getElementById('searchModal');
const closeSearchBtn = document.getElementById('closeSearchBtn');
const fetchWallpapersBtn = document.getElementById('fetchWallpapersBtn');
const searchQueryInput = document.getElementById('searchQueryInput');
const resolutionSelect = document.getElementById('resolutionSelect');
const searchResultsGrid = document.getElementById('searchResultsGrid');

if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
        searchModal.style.display = 'none';
    });
}

if (searchModal) {
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) searchModal.style.display = 'none';
    });
}

async function performSearch(append = false) {
    if (!pixabayApiKey) {
        if (searchModal) searchModal.style.display = 'none';
        if (settingsModal) {
            settingsModal.classList.add('open');
            void settingsModal.offsetHeight;
            if (pixabayKeyInput) pixabayKeyInput.focus();
        }
        return;
    }

    if (!append) {
        searchPage = 1;
        currentSearchQuery = searchQueryInput.value.trim() || 'wallpaper';
        currentSearchResolution = resolutionSelect ? resolutionSelect.value : 'any';
        searchResultsGrid.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">Searching matching wallpapers...</p>';
    }

    try {
        const data = await ipcRenderer.invoke('fetch-pixabay-wallpapers', { 
            query: currentSearchQuery, 
            resolution: currentSearchResolution, 
            page: searchPage,
            apiKey: pixabayApiKey
        });

        if (data && data.error === 'NO_API_KEY') {
            if (searchModal) searchModal.style.display = 'none';
            if (settingsModal) {
                settingsModal.classList.add('open');
                void settingsModal.offsetHeight;
                if (pixabayKeyInput) pixabayKeyInput.focus();
            }
            return;
        }

        if (!append) {
            searchResultsGrid.innerHTML = '';
        } else {
            const existingLoadMore = document.getElementById('loadMoreBtnContainer');
            if (existingLoadMore) existingLoadMore.remove();
        }

        if ((!data.hits || data.hits.length === 0) && !append) {
            searchResultsGrid.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">No wallpapers found. Try a broader search term or check your API key!</p>';
            return;
        }

        data.hits.forEach((photo) => {
            const imageUrl = photo.largeImageURL; 
            const previewUrl = photo.previewURL;  
            
            const rawTags = photo.tags ? photo.tags.split(',')[0].trim() : currentSearchQuery;
            const capitalizedTag = rawTags.charAt(0).toUpperCase() + rawTags.slice(1);
            const photoName = `${capitalizedTag} (${photo.imageWidth}x${photo.imageHeight})`;

            const card = document.createElement('div');
            card.className = 'thumb-card';
            card.style.opacity = '1';
            card.innerHTML = `
                <div class="thumb-img-wrapper" style="position: relative; height: 120px; overflow: hidden; border-radius: 8px; background: #1a1a1a;">
                    <img src="${previewUrl}" class="thumb-img" alt="${currentSearchQuery}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button class="btn primary-btn import-btn" style="position: absolute; bottom: 8px; right: 8px; font-size: 0.65rem; padding: 4px 8px; z-index: 5; cursor:pointer;">Import</button>
                </div>
                <div class="thumb-name" style="margin-top: 6px; font-size: 0.8rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${photoName}">${photoName}</div>
            `;
            
            card.querySelector('.import-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                importOnlineWallpaper(imageUrl, photoName);
            });

            searchResultsGrid.appendChild(card);
        });

        if (data.hits.length > 0) {
            const loadMoreContainer = document.createElement('div');
            loadMoreContainer.id = 'loadMoreBtnContainer';
            loadMoreContainer.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 20px;';
            loadMoreContainer.innerHTML = `<button id="loadMoreBtn" class="btn secondary-btn" style="padding: 10px 20px; cursor: pointer;">Load More Wallpapers</button>`;
            searchResultsGrid.appendChild(loadMoreContainer);

            document.getElementById('loadMoreBtn').addEventListener('click', () => {
                searchPage++;
                performSearch(true);
            });
        }
    } catch (error) {
        if (!append) {
            searchResultsGrid.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">Failed to fetch wallpapers. Check your connection or API key.</p>';
        }
    }
}

if (fetchWallpapersBtn) {
    fetchWallpapersBtn.addEventListener('click', () => performSearch(false));
}

if (searchQueryInput) {
    searchQueryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(false);
    });
}

async function importOnlineWallpaper(url, name) {
    statusText.innerText = 'Downloading wallpaper to PC...';
    
    const localPath = await ipcRenderer.invoke('download-and-save-image', { imageUrl: url, photoName: name });

    if (localPath) {
        if (!allImages.includes(localPath)) {
            allImages.push(localPath);
            imageNames[localPath] = name;
            saveData();
            updateDisplay();
        }
        alert(`Successfully downloaded and imported "${name}" to your Wallcycle collection!`);
        if (searchModal) searchModal.style.display = 'none';
    } else {
        alert('Failed to download image to local storage.');
    }
    statusText.innerText = 'Ready';
}