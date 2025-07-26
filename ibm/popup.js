// DOM elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const rewardPointsEl = document.getElementById('rewardPoints');
const activeTimeEl = document.getElementById('activeTime');
const distractionTimeEl = document.getElementById('distractionTime');
const productiveTimeEl = document.getElementById('productiveTime');

// Behavior tracking timer
let behaviorUpdateInterval = null;
let currentTabStartTime = null;
let currentTabUrl = null;

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
        
        // Load behavior stats when behavior tab is clicked
        if (tabId === 'behavior') {
            loadBehaviorStats();
            startBehaviorStatsUpdate();
        } else {
            stopBehaviorStatsUpdate();
        }
    });
});

// Start real-time behavior stats updates
function startBehaviorStatsUpdate() {
    stopBehaviorStatsUpdate(); // Clear any existing interval
    behaviorUpdateInterval = setInterval(loadBehaviorStats, 500); // Update every 500ms for real-time feel
}

// Stop behavior stats updates
function stopBehaviorStatsUpdate() {
    if (behaviorUpdateInterval) {
        clearInterval(behaviorUpdateInterval);
        behaviorUpdateInterval = null;
    }
}

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

// Load behavior tracking stats (FIXED VERSION)
function loadBehaviorStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        
        const currentUrl = tabs[0].url;
        const hostname = new URL(currentUrl).hostname;
        
        // Update current URL display
        document.getElementById('currentUrl').textContent = hostname;
        
        // Handle per-site session time
        if (currentTabUrl !== currentUrl) {
            currentTabUrl = currentUrl;
            currentTabStartTime = Date.now();
        }
        
        // Calculate and display per-site session time
        if (currentTabStartTime) {
            const sessionSeconds = Math.floor((Date.now() - currentTabStartTime) / 1000);
            document.getElementById('sessionTime').textContent = formatTimeDetailed(sessionSeconds);
        } else {
            document.getElementById('sessionTime').textContent = '0s';
        }
        
        // Load global tab switches
        chrome.storage.local.get(['sessionData'], (result) => {
            const sessionData = result.sessionData || {};
            document.getElementById('tabSwitches').textContent = sessionData.tabSwitchCount || 0;
        });
        
        // Load behavior data for current site - FIXED LOGIC
        chrome.storage.local.get(['behaviorData'], (result) => {
            const behaviorData = result.behaviorData || {};
            const siteData = behaviorData[hostname] || [];
            
            if (siteData.length > 0) {
                // Get the most recent session data
                const latestSession = siteData[siteData.length - 1];
                const now = Date.now();
                
                // Check if this session is still active (within 30 seconds of last update)
                const timeSinceUpdate = now - (latestSession.lastUpdated ? new Date(latestSession.lastUpdated).getTime() : latestSession.pageLoadTime);
                
                if (timeSinceUpdate < 30000) { // 30 seconds
                    document.getElementById('pageClicks').textContent = latestSession.clicks || 0;
                    document.getElementById('pageScrolls').textContent = latestSession.scrolls || 0;
                    document.getElementById('mouseMovements').textContent = latestSession.mouseMovements || 0;
                } else {
                    // Session is stale, show 0
                    document.getElementById('pageClicks').textContent = '0';
                    document.getElementById('pageScrolls').textContent = '0';
                    document.getElementById('mouseMovements').textContent = '0';
                }
            } else {
                // No data for this site
                document.getElementById('pageClicks').textContent = '0';
                document.getElementById('pageScrolls').textContent = '0';
                document.getElementById('mouseMovements').textContent = '0';
            }
        });
    });
}

// Format time in minutes
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
}

// Format time with detailed breakdown (for behavior tracking)
function formatTimeDetailed(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}


// Export behavior data function (IMPROVED VERSION)
function exportBehaviorData() {
    // Get all data from storage first
    chrome.storage.local.get(null, (data) => {
        const exportData = {
            sessionData: data.sessionData || {},
            visitFrequency: data.visitFrequency || {},
            behaviorData: data.behaviorData || {},
            todayStats: data.todayStats || {},
            urlTimeSpent: data.urlTimeSpent || {},
            distractionUrls: data.distractionUrls || [],
            productiveUrls: data.productiveUrls || [],
            rewardPoints: data.rewardPoints || 0,
            exportTime: new Date().toISOString(),
            exportedFrom: 'ProductivityGuard'
        };
        
        // Create and download the file directly from popup
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `productivity_guard_data_${Date.now()}.json`;
        link.style.display = 'none';
        
        // Add to page, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up URL object
        URL.revokeObjectURL(url);
        
        // Show success message
        const btn = document.getElementById('exportBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Data Exported!';
        btn.style.background = '#34a853';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    });
}


// Clear behavior data function
function clearBehaviorData() {
    if (confirm('Are you sure you want to clear all tracked behavior data?')) {
        // Clear specific behavior data, not all storage
        chrome.storage.local.remove(['behaviorData', 'sessionData'], () => {
            // Reset current tab tracking
            currentTabStartTime = Date.now();
            currentTabUrl = null;
            
            // Show success message
            const btn = document.getElementById('clearBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Data Cleared!';
            btn.style.background = '#ea4335';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                loadBehaviorStats(); // Reload behavior stats
            }, 2000);
        });
    }
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
    loadBehaviorStats(); // Load behavior stats on popup open
    
    // Add event listeners for behavior tracking buttons
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportBehaviorData);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearBehaviorData);
    }
    
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
        loadBehaviorStats();
    }
    
    // Listen for behavior data updates - CRITICAL FOR REAL-TIME UPDATES
    if (message.type === 'UPDATE_BEHAVIOR_DATA') {
        loadBehaviorStats();
    }
    
    sendResponse({ success: true });
});

// Clean up interval when popup is closed
window.addEventListener('beforeunload', () => {
    stopBehaviorStatsUpdate();
});

// Utility: Get latest N entries sorted by 'lastUpdated' across all domains
function getLatestBehaviorEntries(data, limit = 20) {
    const allEntries = [];

    for (const [domain, sessions] of Object.entries(data.behaviorData || {})) {
        sessions.forEach(session => {
            allEntries.push({ domain, ...session });
        });
    }

    // Sort by lastUpdated descending
    allEntries.sort((a, b) => {
        const timeA = new Date(a.lastUpdated || a.timeOfDay || 0).getTime();
        const timeB = new Date(b.lastUpdated || b.timeOfDay || 0).getTime();
        return timeB - timeA;
    });

    return allEntries.slice(0, limit);
}

// Send the filtered data to backend
async function autoUploadLatestBehavior() {
    try {
        const result = await chrome.storage.local.get(['behaviorData']);
        const latestEntries = getLatestBehaviorEntries(result, 20);

        const response = await fetch('http://localhost:5000/api/behavior-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ behavior: latestEntries, uploadedAt: new Date().toISOString() })
        });

        if (!response.ok) {
            console.error('Auto-upload failed with status:', response.status);
        } else {
            console.log('Auto-upload success:', await response.json());
        }
    } catch (error) {
        console.error('Error in auto-upload:', error);
    }
}

// Start 1-min interval for uploading data
function startAutoUploadTimer() {
    setInterval(autoUploadLatestBehavior, 60000); // every 60 seconds
}

// Call it on popup open
document.addEventListener('DOMContentLoaded', () => {
    // (already existing initialization code above...)
    startAutoUploadTimer();
});
