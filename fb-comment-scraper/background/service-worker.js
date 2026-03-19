chrome.runtime.onInstalled.addListener(() => {
  console.log('FB Comment Scraper installed.');
});

// Centralized message routing if needed, but for now 
// popup will communicate directly with content scripts.
// Keeping this service worker active for future capabilities 
// such as managing large memory states outside the popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'HEARTBEAT') {
    sendResponse({ ok: true });
  }
});
