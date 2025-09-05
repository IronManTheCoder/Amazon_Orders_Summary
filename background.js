// background.js (MV3 service worker)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Amazon Spend Dashboard installed");
});

// Handle tab navigation scanning
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PING") {
    sendResponse({ ok: true, ts: Date.now() });
    return;
  }
  
  if (msg?.type === "START_TAB_SCAN") {
    console.log('Starting tab navigation scan:', msg.data);
    startTabNavigationScan(msg.data, sender.tab.id);
    sendResponse({ success: true });
    return;
  }
});

// Perform tab navigation scan
async function startTabNavigationScan(scanData, originalTabId) {
  const { 
    totalAmount: initialAmount, 
    totalOrderCount: initialCount, 
    currentPage, 
    expectedTotalOrders, 
    maxPages, 
    baseUrl, 
    timeFilter 
  } = scanData;
  
  let totalAmount = initialAmount;
  let totalOrderCount = initialCount;
  let pageNum = currentPage;
  
  try {
    // Navigate through pages 2 to N
    for (let startIndex = 10; pageNum < maxPages; startIndex += 10) {
      // Check if we've covered all expected orders
      if (expectedTotalOrders && startIndex >= expectedTotalOrders) {
        console.log(`All ${expectedTotalOrders} orders covered, stopping`);
        break;
      }
      
      pageNum++;
      const pageUrl = `${baseUrl}?timeFilter=${timeFilter}&startIndex=${startIndex}&ref_=ppx_yo2ov_dt_b_pagination_${pageNum-1}_${pageNum}`;
      
      console.log(`Navigating to page ${pageNum}: ${pageUrl}`);
      
      // Send update to original tab
      chrome.tabs.sendMessage(originalTabId, {
        type: 'SCAN_UPDATE',
        data: {
          totalAmount,
          totalOrderCount,
          status: `Navigating to page ${pageNum}...`,
          currentPage: pageNum
        }
      });
      
      try {
        // Create a new tab for this page
        const newTab = await chrome.tabs.create({
          url: pageUrl,
          active: false // Don't switch to this tab
        });
        
        // Wait for the tab to load
        await waitForTabLoad(newTab.id);
        
        // Execute content script to scan this page
        const results = await chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: scanCurrentPageOrders
        });
        
        if (results && results[0] && results[0].result) {
          const pageResult = results[0].result;
          totalAmount += pageResult.total;
          totalOrderCount += pageResult.count;
          
          console.log(`Page ${pageNum}: $${pageResult.total} from ${pageResult.count} orders`);
          
          // Send update to original tab
          chrome.tabs.sendMessage(originalTabId, {
            type: 'SCAN_UPDATE',
            data: {
              totalAmount,
              totalOrderCount,
              status: `Page ${pageNum} complete`,
              currentPage: pageNum
            }
          });
          
          // If no orders found, we've reached the end
          if (pageResult.count === 0) {
            console.log(`No orders found on page ${pageNum}, stopping`);
            chrome.tabs.remove(newTab.id);
            break;
          }
        }
        
        // Close the temporary tab
        chrome.tabs.remove(newTab.id);
        
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error scanning page ${pageNum}:`, error);
        break;
      }
    }
    
    // Send completion message
    chrome.tabs.sendMessage(originalTabId, {
      type: 'SCAN_COMPLETE',
      data: {
        totalAmount,
        totalOrderCount,
        totalPages: pageNum
      }
    });
    
  } catch (error) {
    console.error('Tab navigation scan error:', error);
    chrome.tabs.sendMessage(originalTabId, {
      type: 'SCAN_UPDATE',
      data: {
        totalAmount,
        totalOrderCount,
        status: `Error: ${error.message}`,
        currentPage: pageNum
      }
    });
  }
}

// Wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function checkStatus() {
      chrome.tabs.get(tabId, (tab) => {
        if (tab.status === 'complete') {
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      });
    }
    checkStatus();
  });
}

// Function to inject into each tab for scanning
function scanCurrentPageOrders() {
  // This function will be injected into each tab
  // It needs to be self-contained with all necessary logic
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set();
  
  // Look for order containers
  const orderSelectors = ['.a-box-group', '[class*="order"]', '[class*="shipment"]', '.a-card'];
  
  let orderElements = [];
  for (const selector of orderSelectors) {
    orderElements = document.querySelectorAll(selector);
    if (orderElements.length > 0) {
      break;
    }
  }
  
  // If no containers, look for elements with order text
  if (orderElements.length === 0) {
    const allElements = document.querySelectorAll('*');
    orderElements = Array.from(allElements).filter(el => {
      const text = el.textContent;
      return (text.includes('Order placed') || text.includes('Total')) && 
             !text.includes('var ') && 
             !text.includes('function') && 
             text.length > 30 && text.length < 2000;
    });
  }
  
  // Process each order element
  orderElements.forEach((element) => {
    const text = element.textContent;
    
    // Skip JavaScript elements
    if (text.includes('window.uet') || text.includes('performance.mark') || 
        text.includes('function(') || text.length < 50) {
      return;
    }
    
    // Look for dollar amounts
    const moneyMatches = text.match(/\$(\d+(?:\.\d{2})?)/g);
    
    if (moneyMatches && moneyMatches.length > 0) {
      const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
      const maxAmount = Math.max(...amounts);
      
      if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
        // Check if this looks like a real order
        const hasOrderText = text.includes('Order placed') || text.includes('Total') || text.includes('Order #');
        const hasMonth = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(text);
        
        if (hasOrderText && hasMonth) {
          totalAmount += maxAmount;
          orderCount++;
          processedAmounts.add(maxAmount);
        }
      }
    }
  });
  
  return { total: totalAmount, count: orderCount };
}