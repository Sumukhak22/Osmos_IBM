// Content script to track user interactions on web pages
let behaviorData = {
  url: window.location.href,
  clicks: 0,
  scrolls: 0,
  keystrokes: 0,
  mouseMovements: 0,
  typingSpeed: {
    totalKeys: 0,
    totalTime: 0,
    sessions: []
  },
  timeOfDay: new Date().toISOString(),
  pageLoadTime: Date.now()
};

let typingSession = {
  startTime: null,
  keyCount: 0
};

let lastMouseMove = Date.now();
let mouseMoveThrottle = 100; // ms

// Track clicks
document.addEventListener('click', (event) => {
  behaviorData.clicks++;
  saveBehaviorData();
});

// Track scrolls
let scrollThrottle = false;
document.addEventListener('scroll', () => {
  if (!scrollThrottle) {
    behaviorData.scrolls++;
    saveBehaviorData();
    scrollThrottle = true;
    setTimeout(() => { scrollThrottle = false; }, 100);
  }
});

// Track mouse movements
document.addEventListener('mousemove', (event) => {
  const now = Date.now();
  if (now - lastMouseMove > mouseMoveThrottle) {
    behaviorData.mouseMovements++;
    lastMouseMove = now;
    saveBehaviorData();
  }
});

// Track keystrokes and typing speed
document.addEventListener('keydown', (event) => {
  // Only track actual character keys, not function keys
  if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
    behaviorData.keystrokes++;
    
    // Typing speed calculation
    const now = Date.now();
    
    if (!typingSession.startTime) {
      typingSession.startTime = now;
      typingSession.keyCount = 1;
    } else {
      typingSession.keyCount++;
      
      // End session after 2 seconds of no typing
      clearTimeout(typingSession.timeout);
      typingSession.timeout = setTimeout(() => {
        if (typingSession.keyCount > 5) { // Only record sessions with meaningful typing
          const sessionDuration = (now - typingSession.startTime) / 1000; // seconds
          const wpm = (typingSession.keyCount / 5) / (sessionDuration / 60); // words per minute
          
          behaviorData.typingSpeed.sessions.push({
            wpm: Math.round(wpm),
            duration: sessionDuration,
            keyCount: typingSession.keyCount,
            timestamp: new Date().toISOString()
          });
          
          behaviorData.typingSpeed.totalKeys += typingSession.keyCount;
          behaviorData.typingSpeed.totalTime += sessionDuration;
        }
        
        // Reset session
        typingSession = { startTime: null, keyCount: 0 };
        saveBehaviorData();
      }, 2000);
    }
    
    saveBehaviorData();
  }
});

// Track page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is now hidden
    saveBehaviorData();
  } else {
    // Page is now visible
    behaviorData.timeOfDay = new Date().toISOString();
  }
});

// Track page unload
window.addEventListener('beforeunload', () => {
  saveBehaviorData();
});

function saveBehaviorData() {
  const dataToSave = {
    ...behaviorData,
    sessionDuration: Date.now() - behaviorData.pageLoadTime,
    lastUpdated: new Date().toISOString()
  };
  
  // Save to chrome storage
  chrome.storage.local.get(['behaviorData'], (result) => {
    const allBehaviorData = result.behaviorData || {};
    const urlKey = new URL(window.location.href).hostname;
    
    if (!allBehaviorData[urlKey]) {
      allBehaviorData[urlKey] = [];
    }
    
    // Update existing entry for this session or add new one
    const existingIndex = allBehaviorData[urlKey].findIndex(
      entry => entry.pageLoadTime === behaviorData.pageLoadTime
    );
    
    if (existingIndex >= 0) {
      allBehaviorData[urlKey][existingIndex] = dataToSave;
    } else {
      allBehaviorData[urlKey].push(dataToSave);
    }
    
    chrome.storage.local.set({ behaviorData: allBehaviorData });
  });
  
  // Notify background script
  chrome.runtime.sendMessage({ type: 'UPDATE_BEHAVIOR_DATA' });
}

// Initial save
saveBehaviorData();

// Periodic save every 30 seconds
setInterval(saveBehaviorData, 30000);