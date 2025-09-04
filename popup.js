const statusEl = document.getElementById("status");

function setStatus(msg) {
  statusEl.textContent = msg;
}

// Open Orders page
document.getElementById("openOrders").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://www.amazon.com/gp/css/order-history" });
  setStatus("Opening Amazon Orders page...");
});