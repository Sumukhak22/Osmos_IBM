// Background script to handle tab switches and session management
let sessionData = {};
let tabSwitchCount = 0;
let sessionStartTime = Date.now();

// Initialize session data
chrome.runtime.onStartup.addListener(() => {
  sessionStartTime = Date.now();
  tabSwitchCount = 0;
});

chrome.runtime.onInstalled.addListener(() => {
  sessionStartTime = Date.now();
  tabSwitchCount = 0;
});

// Track tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
  tabSwitchCount++;
  updateSessionData();
});

// Track tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateVisitFrequency(tab.url);
  }
});

function updateSessionData() {
  const currentTime = Date.now();
  const sessionTime = Math.floor((currentTime - sessionStartTime) / 1000); // in seconds
  
  sessionData = {
    sessionTime: sessionTime,
    tabSwitchCount: tabSwitchCount,
    timestamp: new Date().toISOString()
  };
  
  // Store in chrome storage
  chrome.storage.local.set({ sessionData: sessionData });
}

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

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BEHAVIOR_DATA') {
    updateSessionData();
    sendResponse({ success: true });
  }
  
  if (message.type === 'EXPORT_DATA') {
    exportAllData();
    sendResponse({ success: true });
  }
});

function exportAllData() {
  chrome.storage.local.get(null, (data) => {
    const exportData = {
      sessionData: data.sessionData || {},
      visitFrequency: data.visitFrequency || {},
      behaviorData: data.behaviorData || {},
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

// Update session data every minute
setInterval(updateSessionData, 60000);