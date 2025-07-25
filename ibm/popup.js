// DOM elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const rewardPointsEl = document.getElementById('rewardPoints');
const activeTimeEl = document.getElementById('activeTime');
const distractionTimeEl = document.getElementById('distractionTime');
const productiveTimeEl = document.getElementById('productiveTime');

// Sound functionality
function playSound() {
    try {
        const audio = new Audio(chrome.runtime.getURL('sound.wav'));
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Sound play failed:', e));
    } catch (e) {
        console.log('Sound creation failed:', e);
    }
}

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        playSound();
        const tabId = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
            }
        });
    });
});

// Load and display data
async function loadData() {
    try {
        const result = await chrome.storage.local.get([
            'rewardPoints', 'todayStats', 'distractionUrls', 'productiveUrls'
        ]);
        
        // Update reward points
        rewardPointsEl.textContent = result.rewardPoints || 0;
        
        // Update today's stats
        const stats = result.todayStats || {};
        activeTimeEl.textContent = formatTime(stats.activeTime || 0);
        distractionTimeEl.textContent = formatTime(stats.distractionTime || 0);
        productiveTimeEl.textContent = formatTime(stats.productiveTime || 0);
        
        // Update URL lists
        displayUrlList('distraction', result.distractionUrls || []);
        displayUrlList('productive', result.productiveUrls || []);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Format time in minutes
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
}

// Display URL list
function displayUrlList(type, urls) {
    const listEl = document.getElementById(`${type}List`);
    listEl.innerHTML = '';
    
    urls.forEach((urlData, index) => {
        const item = document.createElement('div');
        item.className = 'url-item';
        
        const domain = new URL(urlData.url).hostname;
        
        item.innerHTML = `
            <div class="url-info">
                <div class="url-domain">${domain}</div>
                <div class="url-time">${urlData.timeLimit}min limit</div>
            </div>
            <button class="remove-btn" data-type="${type}" data-index="${index}">×</button>
        `;
        
        listEl.appendChild(item);
    });
}

// Add distraction URL
document.getElementById('addDistraction').addEventListener('click', async () => {
    playSound();
    const urlInput = document.getElementById('distractionUrl');
    const timeInput = document.getElementById('distractionTime');
    
    const url = urlInput.value.trim();
    const timeLimit = parseInt(timeInput.value);
    
    if (!url || !timeLimit) {
        alert('Please enter both URL and time limit');
        return;
    }
    
    try {
        new URL(url); // Validate URL
        
        const result = await chrome.storage.local.get(['distractionUrls']);
        const distractionUrls = result.distractionUrls || [];
        
        distractionUrls.push({ url, timeLimit: timeLimit * 60 }); // Convert to seconds
        
        await chrome.storage.local.set({ distractionUrls });
        
        // Send to backend
        await sendToBackend('/api/distraction-urls', { urls: distractionUrls });
        
        urlInput.value = '';
        timeInput.value = '';
        
        displayUrlList('distraction', distractionUrls);
        
    } catch (error) {
        alert('Please enter a valid URL');
    }
});

// Add productive URL
document.getElementById('addProductive').addEventListener('click', async () => {
    playSound();
    const urlInput = document.getElementById('productiveUrl');
    const timeInput = document.getElementById('productiveTime');
    
    const url = urlInput.value.trim();
    const targetTime = parseInt(timeInput.value);
    
    if (!url || !targetTime) {
        alert('Please enter both URL and target time');
        return;
    }
    
    try {
        new URL(url); // Validate URL
        
        const result = await chrome.storage.local.get(['productiveUrls']);
        const productiveUrls = result.productiveUrls || [];
        
        productiveUrls.push({ url, targetTime: targetTime * 60 }); // Convert to seconds
        
        await chrome.storage.local.set({ productiveUrls });
        
        // Send to backend
        await sendToBackend('/api/productive-urls', { urls: productiveUrls });
        
        urlInput.value = '';
        timeInput.value = '';
        
        displayUrlList('productive', productiveUrls);
        
    } catch (error) {
        alert('Please enter a valid URL');
    }
});

// Remove URL
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-btn')) {
        playSound();
        const type = e.target.dataset.type;
        const index = parseInt(e.target.dataset.index);
        
        const storageKey = `${type}Urls`;
        const result = await chrome.storage.local.get([storageKey]);
        const urls = result[storageKey] || [];
        
        urls.splice(index, 1);
        
        await chrome.storage.local.set({ [storageKey]: urls });
        
        // Send updated list to backend
        const endpoint = type === 'distraction' ? '/api/distraction-urls' : '/api/productive-urls';
        await sendToBackend(endpoint, { urls });
        
        displayUrlList(type, urls);
    }
});

// Quick actions
document.getElementById('pauseTracking').addEventListener('click', async () => {
    playSound();
    const result = await chrome.storage.local.get(['trackingPaused']);
    const isPaused = !result.trackingPaused;
    
    await chrome.storage.local.set({ trackingPaused: isPaused });
    
    document.getElementById('pauseTracking').textContent = 
        isPaused ? 'Resume Tracking' : 'Pause Tracking';
});

document.getElementById('focusMode').addEventListener('click', async () => {
    playSound();
    const result = await chrome.storage.local.get(['focusMode']);
    const isFocusMode = !result.focusMode;
    
    await chrome.storage.local.set({ focusMode: isFocusMode });
    
    document.getElementById('focusMode').textContent = 
        isFocusMode ? 'Exit Focus Mode' : 'Focus Mode';
    
    // Notify background script
    chrome.runtime.sendMessage({ action: 'toggleFocusMode', enabled: isFocusMode });
});

// Settings
document.getElementById('enableNotifications').addEventListener('change', async (e) => {
    playSound();
    await chrome.storage.local.set({ notificationsEnabled: e.target.checked });
});

document.getElementById('enableStrictMode').addEventListener('change', async (e) => {
    playSound();
    await chrome.storage.local.set({ strictMode: e.target.checked });
});

// Send data to backend
async function sendToBackend(endpoint, data) {
    try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            console.error('Backend request failed:', response.status);
        }
    } catch (error) {
        console.error('Error sending to backend:', error);
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Load settings
    chrome.storage.local.get([
        'trackingPaused', 'focusMode', 'notificationsEnabled', 'strictMode'
    ]).then(result => {
        document.getElementById('pauseTracking').textContent = 
            result.trackingPaused ? 'Resume Tracking' : 'Pause Tracking';
        
        document.getElementById('focusMode').textContent = 
            result.focusMode ? 'Exit Focus Mode' : 'Focus Mode';
        
        document.getElementById('enableNotifications').checked = 
            result.notificationsEnabled !== false;
        
        document.getElementById('enableStrictMode').checked = 
            result.strictMode || false;
    });
});

// Listen for updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStats') {
        loadData();
    }
});