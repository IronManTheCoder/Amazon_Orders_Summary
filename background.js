// background.js (MV3 service worker)
// Keeps lightweight; mainly for future expansion (alarms, external auth, etc.)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Amazon Spend Dashboard installed");
});

// Optional: relay messages or persist long-running tasks later
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PING") {
    sendResponse({ ok: true, ts: Date.now() });
  }
});