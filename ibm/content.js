// Content script for tracking user interactions and showing notifications
let interactionData = {
    clicks: 0,
    keystrokes: 0,
    mouseMovements: 0,
    scrolls: 0
};

let lastMouseMove = 0;
let typingSpeed = [];
let lastKeyTime = 0;

// Track mouse clicks
document.addEventListener('click', () => {
    interactionData.clicks++;
}, true);

// Track mouse movements (throttled)
document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastMouseMove > 100) { // Throttle to every 100ms
        interactionData.mouseMovements++;
        lastMouseMove = now;
    }
}, true);

// Track keystrokes and typing speed
document.addEventListener('keydown', (e) => {
    const now = Date.now();
    interactionData.keystrokes++;
    
    // Calculate typing speed
    if (lastKeyTime > 0) {
        const timeDiff = now - lastKeyTime;
        typingSpeed.push(timeDiff);
        
        // Keep only last 10 intervals
        if (typingSpeed.length > 10) {
            typingSpeed.shift();
        }
    }
    lastKeyTime = now;
}, true);

// Track scrolling
document.addEventListener('scroll', () => {
    interactionData.scrolls++;
}, true);

// Send interaction data to background script every 10 seconds
setInterval(() => {
    if (interactionData.clicks > 0 || interactionData.keystrokes > 0 || 
        interactionData.mouseMovements > 0 || interactionData.scrolls > 0) {
        
        // Calculate average typing speed
        const avgTypingSpeed = typingSpeed.length > 0 ? 
            typingSpeed.reduce((a, b) => a + b, 0) / typingSpeed.length : 0;
        
        chrome.runtime.sendMessage({
            action: 'updateInteractionData',
            data: {
                ...interactionData,
                avgTypingSpeed
            }
        }).catch(() => {});
        
        // Reset counters
        interactionData = { clicks: 0, keystrokes: 0, mouseMovements: 0, scrolls: 0 };
    }
}, 10000);

// Function to create floating notification (injected by background script)
function createFloatingNotification(domain, question) {
    // Remove existing notification
    const existing = document.getElementById('productivity-guard-notification');
    if (existing) {
        existing.remove();
    }
    
    // Create notification container
    const notification = document.createElement('div');
    notification.id = 'productivity-guard-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: linear-gradient(135deg, #ff6b6b, #feca57);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    
    notification.innerHTML = `
        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 8px;">⚠️ Time Limit Exceeded</div>
            <div style="font-size: 12px; opacity: 0.9;">Domain: ${domain}</div>
        </div>
        <div style="margin-bottom: 15px; line-height: 1.4;">
            ${question}
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="pg-yes-btn" style="
                flex: 1;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            ">Yes</button>
            <button id="pg-no-btn" style="
                flex: 1;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            ">No</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add button hover effects
    const buttons = notification.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255, 255, 255, 0.3)';
            btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255, 255, 255, 0.2)';
            btn.style.transform = 'scale(1)';
        });
    });
    
    // Handle button clicks
    document.getElementById('pg-yes-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'answerQuestion',
            answer: 'yes',
            domain: domain
        });
        notification.remove();
    });
    
    document.getElementById('pg-no-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'answerQuestion',
            answer: 'no',
            domain: domain
        });
        notification.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Function to create blocking popup (injected by background script)
function createBlockingPopup(domain, question) {
    // Remove existing popup
    const existing = document.getElementById('productivity-guard-blocking');
    if (existing) {
        existing.remove();
    }
    
    // Create blocking overlay
    const overlay = document.createElement('div');
    overlay.id = 'productivity-guard-blocking';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
    `;
    document.head.appendChild(style);
    
    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        color: white;
        text-align: center;
        max-width: 500px;
        width: 90%;
        animation: shake 0.5s ease-in-out;
    `;
    
    popup.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
        <h2 style="margin: 0 0 20px 0; font-size: 24px;">Access Restricted</h2>
        <p style="margin: 0 0 10px 0; opacity: 0.8;">Domain: ${domain}</p>
        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.5;">${question}</p>
        <div style="display: flex; gap: 20px; justify-content: center;">
            <button id="pg-block-yes" style="
                padding: 15px 30px;
                background: #ff6b6b;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s ease;
            ">Yes, Continue</button>
            <button id="pg-block-no" style="
                padding: 15px 30px;
                background: #51cf66;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s ease;
            ">No, Go Back</button>
        </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Add button hover effects
    const buttons = popup.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });
    });
    
    // Handle button clicks
    document.getElementById('pg-block-yes').addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'answerQuestion',
            answer: 'yes',
            domain: domain
        });
        overlay.remove();
    });
    
    document.getElementById('pg-block-no').addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'answerQuestion',
            answer: 'no',
            domain: domain
        });
        overlay.remove();
        window.history.back();
    });
    
    // Prevent interaction with the page
    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    // Disable keyboard shortcuts
    const blockKeyboard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    
    document.addEventListener('keydown', blockKeyboard, true);
    
    // Clean up keyboard blocking when popup is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === overlay) {
                    document.removeEventListener('keydown', blockKeyboard, true);
                    observer.disconnect();
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showNotification') {
        createFloatingNotification(message.domain, message.question);
    } else if (message.action === 'showBlockingPopup') {
        createBlockingPopup(message.domain, message.question);
    }
    
    sendResponse({ success: true });
});