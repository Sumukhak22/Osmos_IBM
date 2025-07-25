// content.js

function toggleSidebar(isDark) {
  // (exact same body as in popup.js – copy/paste verbatim)
  const existingSidebar = document.getElementById('my-extension-sidebar');
  if (existingSidebar) {
    existingSidebar.remove();
    document.body.style.marginRight = '0px';
    const bubble = document.getElementById('vision-chat-bubble');
    if (bubble) bubble.remove();
    return;
  }

  const sidebar = document.createElement('div');
  sidebar.id = 'my-extension-sidebar';

  sidebar.innerHTML = `
    <div style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0;">✨ Sidebar</h3>
        <button id="close-sidebar" style="background: red; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px;">×</button>
      </div>
      <div style="margin-bottom: 15px;">
        <button onclick="alert('📊 Dashboard clicked!')" style="width: 100%; padding: 10px; margin: 5px 0; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">📊 Dashboard</button>
        <button onclick="alert('📈 Analytics clicked!')" style="width: 100%; padding: 10px; margin: 5px 0; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">📈 Analytics</button>
        <button onclick="alert('⚙️ Settings clicked!')" style="width: 100%; padding: 10px; margin: 5px 0; background: #FF9800; color: white; border: none; border-radius: 5px; cursor: pointer;">⚙️ Settings</button>
        <button id="toggle-mode" style="width: 100%; padding: 10px; margin-top: 10px; background: #555; color: white; border: none; border-radius: 5px; cursor: pointer;">🌗 Toggle Dark Mode</button>
      </div>
    </div>
  `;

  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100vh;
    background: ${isDark ? '#2c2c2c' : 'white'};
    color: ${isDark ? '#eee' : '#000'};
    font-family: 'Segoe UI Emoji', sans-serif;
    border-left: 3px solid #333;
    box-shadow: -5px 0 15px rgba(0,0,0,0.3);
    z-index: 999999;
    transition: transform 0.3s ease, opacity 0.3s ease;
    transform: translateX(100%);
    opacity: 0;
  `;
  document.body.appendChild(sidebar);
  document.body.style.marginRight = '300px';
  setTimeout(() => {
    sidebar.style.transform = 'translateX(0)';
    sidebar.style.opacity = '1';
  }, 10);

  document.getElementById('close-sidebar').addEventListener('click', () => {
    sidebar.style.transform = 'translateX(100%)';
    sidebar.style.opacity = '0';
    setTimeout(() => sidebar.remove(), 300);
    document.body.style.marginRight = '0px';
    const bubble = document.getElementById('vision-chat-bubble');
    if (bubble) bubble.remove();
  });

  document.getElementById('toggle-mode').addEventListener('click', () => {
    const isNowDark = document.documentElement.classList.toggle('dark');
    sidebar.style.background = isNowDark ? '#2c2c2c' : 'white';
    sidebar.style.color = isNowDark ? '#eee' : '#000';

    const chat = document.getElementById('vision-chat-bubble');
    if (chat) {
      chat.style.background = isNowDark ? '#222' : 'white';
      chat.querySelector('div').style.background = isNowDark ? '#333' : '#f0f0f0';
      chat.querySelector('div').style.color = isNowDark ? '#fff' : '#000';
    }
  });

  const chat = document.createElement('div');
  chat.id = 'vision-chat-bubble';
  chat.innerHTML = `
    <div style="background:${isDark ? '#333' : '#f0f0f0'}; border-radius: 10px 10px 0 0; padding: 10px; color: ${isDark ? '#fff' : '#000'}; display: flex; justify-content: space-between; align-items: center;">
      <span>💬 VisionBot: Hello!</span>
      <button id="close-chat" style="background: transparent; border: none; color: red; font-size: 18px; cursor: pointer;">❌</button>
    </div>
    <div style="padding: 10px;">
      <input type="text" placeholder="Type your question..." style="width: 100%; padding: 8px; border-radius: 5px; border: none;">
    </div>
  `;
  chat.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 320px;
    width: 250px;
    background: ${isDark ? '#222' : 'white'};
    color: ${isDark ? '#eee' : '#000'};
    border: 1px solid #888;
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-family: 'Segoe UI Emoji', sans-serif;
    z-index: 999999;
    overflow: hidden;
    animation: fadeInUp 0.4s ease;
  `;
  document.body.appendChild(chat);
  document.getElementById('close-chat').addEventListener('click', () => chat.remove());
}

function showFloatingBox() {
  const existing = document.getElementById('my-floating-box');
  if (existing) existing.remove();

  const box = document.createElement('div');
  const darkMode = document.documentElement.classList.contains('dark');

  box.id = 'my-floating-box';
  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <strong style="font-size: 18px;">👁 VisionEdge Tip</strong>
      <button id="close-float" style="background: transparent; border: none; color: red; font-size: 20px; cursor: pointer; font-weight: bold;">×</button>
    </div>
    <p style="margin: 0 0 15px 0;">You can toggle the sidebar and customize your experience!</p>
    <button id="dismiss-float" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">Got it!</button>
  `;
  const positions = [
    { top: '20px', left: '20px' },
    { top: '20px', right: '20px' },
    { bottom: '20px', left: '20px' },
    { bottom: '20px', right: '20px' },
    { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  ];
  const randomPos = positions[Math.floor(Math.random() * positions.length)];
  box.style.cssText = `
    position: fixed;
    background: ${darkMode ? '#333' : 'linear-gradient(45deg, #667eea, #764ba2)'};
    color: white;
    padding: 20px;
    border-radius: 10px;
    max-width: 300px;
    font-family: 'Segoe UI Emoji', sans-serif;
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.3s ease;
    z-index: 999999;
  `;
  Object.assign(box.style, randomPos);
  document.body.appendChild(box);
  setTimeout(() => {
    box.style.opacity = '1';
    box.style.transform = randomPos.transform || 'scale(1)';
  }, 10);
  document.getElementById('close-float').addEventListener('click', () => box.remove());
  document.getElementById('dismiss-float').addEventListener('click', () => box.remove());
  setTimeout(() => {
    if (document.getElementById('my-floating-box')) {
      box.style.opacity = '0';
      setTimeout(() => box.remove(), 300);
    }
  }, 10000);
}

// Listen for background.js trigger
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "showFloatingBox") {
    showFloatingBox();
  }
});
