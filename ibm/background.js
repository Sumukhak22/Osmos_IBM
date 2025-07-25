// Background service worker for Chrome extension
let activeTabId = null;
let sessionStartTime = null;
let currentUrl = '';
let trackingInterval = null;
let userInteractionData = {
    clicks: 0,
    keystrokes: 0,
    mouseMovements: 0,
    scrolls: 0
};

// Enhanced session tracking data
let sessionData = {};
let tabSwitchCount = 0;
let sessionGlobalStartTime = Date.now();

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

async function initializeExtension() {
    console.log('Productivity Guard initialized');
    
    // Reset daily stats if it's a new day
    await resetDailyStatsIfNeeded();
    
    // Initialize enhanced session tracking
    sessionGlobalStartTime = Date.now();
    tabSwitchCount = 0;
    
    // Start tracking
    startTracking();
    
    // Set up daily reset alarm
    chrome.alarms.create('dailyReset', {
        when: getNextMidnight(),
        periodInMinutes: 24 * 60
    });
}

// Tab change listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    tabSwitchCount++;
    updateSessionData();
    await handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        await handleTabChange(tabId);
        // Update visit frequency
        if (tab.url) {
            updateVisitFrequency(tab.url);
        }
    }
});

// Handle tab changes
async function handleTabChange(tabId) {
    // Save current session data
    if (activeTabId && sessionStartTime) {
        await saveSessionData();
    }
    
    // Start new session
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && tab.url) {
        activeTabId = tabId;
        currentUrl = tab.url;
        sessionStartTime = Date.now();
        
        // Reset interaction data
        userInteractionData = { clicks: 0, keystrokes: 0, mouseMovements: 0, scrolls: 0 };
        
        // Send tab info to backend
        await sendTabInfoToBackend(tab);
        
        // Check if this URL needs monitoring
        await checkUrlLimits(tab.url);
    }
}

// Enhanced session data update
function updateSessionData() {
    const currentTime = Date.now();
    const sessionTime = Math.floor((currentTime - sessionGlobalStartTime) / 1000); // in seconds
    
    sessionData = {
        sessionTime: sessionTime,
        tabSwitchCount: tabSwitchCount,
        timestamp: new Date().toISOString()
    };
    
    // Store in chrome storage
    chrome.storage.local.set({ sessionData: sessionData });
}

// Enhanced visit frequency tracking
function updateVisitFrequency(url) {
    try {
        const domain = new URL(url).hostname;
        
        chrome.storage.local.get(['visitFrequency'], (result) => {
            const visitFrequency = result.visitFrequency || {};
            visitFrequency[domain] = (visitFrequency[domain] || 0) + 1;
            
            chrome.storage.local.set({ visitFrequency: visitFrequency });
        });
    } catch (error) {
        console.error('Error updating visit frequency:', error);
    }
}

// Save session data
async function saveSessionData() {
    if (!sessionStartTime || !currentUrl) return;
    
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    if (sessionDuration < 5) return; // Ignore very short sessions
    
    const result = await chrome.storage.local.get([
        'todayStats', 'distractionUrls', 'productiveUrls', 'urlTimeSpent'
    ]);
    
    const todayStats = result.todayStats || { activeTime: 0, distractionTime: 0, productiveTime: 0 };
    const distractionUrls = result.distractionUrls || [];
    const productiveUrls = result.productiveUrls || [];
    const urlTimeSpent = result.urlTimeSpent || {};
    
    // Update total active time
    todayStats.activeTime += sessionDuration;
    
    // Check if URL is a distraction or productive
    const domain = extractDomain(currentUrl);
    const isDistraction = distractionUrls.some(d => extractDomain(d.url) === domain);
    const isProductive = productiveUrls.some(p => extractDomain(p.url) === domain);
    
    if (isDistraction) {
        todayStats.distractionTime += sessionDuration;
    } else if (isProductive) {
        todayStats.productiveTime += sessionDuration;
    }
    
    // Update URL-specific time
    if (!urlTimeSpent[domain]) {
        urlTimeSpent[domain] = 0;
    }
    urlTimeSpent[domain] += sessionDuration;
    
    // Save data
    await chrome.storage.local.set({ todayStats, urlTimeSpent });
    
    // Send data to backend
    await sendUsageDataToBackend({
        url: currentUrl,
        domain: domain,
        duration: sessionDuration,
        interactions: userInteractionData,
        timestamp: Date.now(),
        isDistraction,
        isProductive
    });
    
    // Notify popup to update
    chrome.runtime.sendMessage({ action: 'updateStats' }).catch(() => {});
}

// Check URL limits and show alerts
async function checkUrlLimits(url) {
    const result = await chrome.storage.local.get([
        'distractionUrls', 'urlTimeSpent', 'strictMode', 'notificationsEnabled'
    ]);
    
    const distractionUrls = result.distractionUrls || [];
    const urlTimeSpent = result.urlTimeSpent || {};
    const strictMode = result.strictMode || false;
    const notificationsEnabled = result.notificationsEnabled !== false;
    
    const domain = extractDomain(url);
    const timeSpent = urlTimeSpent[domain] || 0;
    
    // Check if this is a distraction URL that exceeded its limit
    const distractionUrl = distractionUrls.find(d => extractDomain(d.url) === domain);
    
    if (distractionUrl && timeSpent >= distractionUrl.timeLimit) {
        const excessTime = timeSpent - distractionUrl.timeLimit;
        
        // Get question from backend
        const question = await getQuestionFromBackend(domain, excessTime);
        
        if (strictMode && excessTime > 300) { // 5 minutes excess
            // Show blocking popup
            await showBlockingPopup(domain, question);
        } else if (notificationsEnabled) {
            // Show floating notification
            await showFloatingNotification(domain, question);
        }
    }
}

// Get question from backend
async function getQuestionFromBackend(domain, excessTime) {
    try {
        const response = await fetch('http://localhost:5000/api/get-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, excessTime })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.question || 'You have exceeded your time limit. Continue?';
        }
    } catch (error) {
        console.error('Error getting question from backend:', error);
    }
    
    return 'You have exceeded your time limit. Continue?';
}

// Show floating notification
async function showFloatingNotification(domain, question) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: createFloatingNotification,
            args: [domain, question]
        }).catch(error => {
            console.error('Error showing floating notification:', error);
        });
    }
}

// Show blocking popup
async function showBlockingPopup(domain, question) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: createBlockingPopup,
            args: [domain, question]
        }).catch(error => {
            console.error('Error showing blocking popup:', error);
        });
    }
}

// Send tab info to backend
async function sendTabInfoToBackend(tab) {
    try {
        await fetch('http://localhost:5000/api/tab-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: tab.url,
                title: tab.title,
                timestamp: Date.now(),
                timeOfDay: new Date().getHours()
            })
        });
    } catch (error) {
        console.error('Error sending tab info to backend:', error);
    }
}

// Send usage data to backend
async function sendUsageDataToBackend(data) {
    try {
        await fetch('http://localhost:5000/api/usage-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error sending usage data to backend:', error);
    }
}

// Enhanced export functionality
function exportAllData() {
    chrome.storage.local.get(null, (data) => {
        const exportData = {
            sessionData: data.sessionData || {},
            visitFrequency: data.visitFrequency || {},
            behaviorData: data.behaviorData || {},
            todayStats: data.todayStats || {},
            urlTimeSpent: data.urlTimeSpent || {},
            exportTime: new Date().toISOString()
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: url,
            filename: `user_behavior_data_${Date.now()}.json`
        });
    });
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'updateInteractionData':
            userInteractionData.clicks += message.data.clicks || 0;
            userInteractionData.keystrokes += message.data.keystrokes || 0;
            userInteractionData.mouseMovements += message.data.mouseMovements || 0;
            userInteractionData.scrolls += message.data.scrolls || 0;
            break;
            
        case 'toggleFocusMode':
            // Handle focus mode toggle
            break;
            
        case 'answerQuestion':
            handleQuestionAnswer(message.answer, message.domain);
            break;
    }
    
    // Handle enhanced behavior tracking messages
    if (message.type === 'UPDATE_BEHAVIOR_DATA') {
        updateSessionData();
        sendResponse({ success: true });
    }
    
    if (message.type === 'EXPORT_DATA') {
        exportAllData();
        sendResponse({ success: true });
    }
    
    sendResponse({ success: true });
});

// Handle question answers
async function handleQuestionAnswer(answer, domain) {
    try {
        const response = await fetch('http://localhost:5000/api/question-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer, domain, timestamp: Date.now() })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update reward points if applicable
            if (data.rewardPoints) {
                const result = await chrome.storage.local.get(['rewardPoints']);
                const currentPoints = result.rewardPoints || 0;
                await chrome.storage.local.set({ rewardPoints: currentPoints + data.rewardPoints });
            }
            
            // Update distraction time limits if applicable
            if (data.updatedLimits) {
                await chrome.storage.local.set({ distractionUrls: data.updatedLimits });
            }
        }
    } catch (error) {
        console.error('Error handling question answer:', error);
    }
}

// Alarm handling
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyReset') {
        resetDailyStatsIfNeeded();
    }
});

// Reset daily stats if needed
async function resetDailyStatsIfNeeded() {
    const result = await chrome.storage.local.get(['lastResetDate']);
    const today = new Date().toDateString();
    
    if (result.lastResetDate !== today) {
        await chrome.storage.local.set({
            todayStats: { activeTime: 0, distractionTime: 0, productiveTime: 0 },
            urlTimeSpent: {},
            lastResetDate: today
        });
        
        console.log('Daily stats reset');
    }
}

// Start tracking
function startTracking() {
    // Save session data every 30 seconds
    trackingInterval = setInterval(async () => {
        const result = await chrome.storage.local.get(['trackingPaused']);
        if (!result.trackingPaused && activeTabId && sessionStartTime) {
            await saveSessionData();
            sessionStartTime = Date.now(); // Reset session start time
        }
    }, 30000);
}

// Update session data every minute
setInterval(updateSessionData, 60000);

// Utility functions
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
}

// Window focus handling
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Browser lost focus
        if (activeTabId && sessionStartTime) {
            await saveSessionData();
            sessionStartTime = null;
        }
    } else {
        // Browser gained focus
        const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
        if (tab) {
            await handleTabChange(tab.id);
        }
    }
});
