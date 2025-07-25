// Popup script to display current stats and handle export
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('clearBtn').addEventListener('click', clearData);
});

function loadStats() {
  // Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      document.getElementById('currentUrl').textContent = 
        new URL(tabs[0].url).hostname;
    }
  });
  
  // Load session data
  chrome.storage.local.get(['sessionData'], (result) => {
    const sessionData = result.sessionData || {};
    document.getElementById('sessionTime').textContent = 
      formatTime(sessionData.sessionTime || 0);
    document.getElementById('tabSwitches').textContent = 
      sessionData.tabSwitchCount || 0;
  });
  
  // Load current page behavior data
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const hostname = new URL(tabs[0].url).hostname;
      
      chrome.storage.local.get(['behaviorData'], (result) => {
        const behaviorData = result.behaviorData || {};
        const siteData = behaviorData[hostname] || [];
        
        if (siteData.length > 0) {
          const currentSession = siteData[siteData.length - 1];
          document.getElementById('pageClicks').textContent = 
            currentSession.clicks || 0;
          document.getElementById('pageScrolls').textContent = 
            currentSession.scrolls || 0;
          document.getElementById('mouseMovements').textContent = 
            currentSession.mouseMovements || 0;
        } else {
          document.getElementById('pageClicks').textContent = '0';
          document.getElementById('pageScrolls').textContent = '0';
          document.getElementById('mouseMovements').textContent = '0';
        }
      });
    }
  });
}

function formatTime(seconds) {
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

function exportData() {
  chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (response) => {
    if (response.success) {
      // Show success message
      const btn = document.getElementById('exportBtn');
      const originalText = btn.textContent;
      btn.textContent = 'Data Exported!';
      btn.style.background = '#34a853';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#4285f4';
      }, 2000);
    }
  });
}

function clearData() {
  if (confirm('Are you sure you want to clear all tracked data?')) {
    chrome.storage.local.clear(() => {
      // Show success message
      const btn = document.getElementById('clearBtn');
      const originalText = btn.textContent;
      btn.textContent = 'Data Cleared!';
      btn.style.background = '#ea4335';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#4285f4';
        loadStats(); // Reload stats
      }, 2000);
    });
  }
}