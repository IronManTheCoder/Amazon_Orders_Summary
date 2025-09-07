// background.js (MV3 service worker)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Amazon Spend Dashboard installed");
});

// Handle tab navigation scanning
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg?.type === "PING") {
      sendResponse({ ok: true, ts: Date.now() });
      return;
    }
    
    if (msg?.type === "START_TAB_SCAN") {
      console.log('Starting tab navigation scan:', msg.data);
      startTabNavigationScan(msg.data, sender.tab.id).catch(error => {
        console.error('Error in tab navigation scan:', error);
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'SCAN_UPDATE',
          data: {
            totalAmount: msg.data.totalAmount || 0,
            totalOrderCount: msg.data.totalOrderCount || 0,
            status: `Error: ${error.message}`,
            currentPage: 1
          }
        }).catch(() => {
          // Ignore errors if tab is closed
        });
      });
      sendResponse({ success: true });
      return;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Perform tab navigation scan
async function startTabNavigationScan(scanData, originalTabId) {
  const { 
    totalAmount: initialAmount, 
    totalOrderCount: initialCount, 
    monthlyData: initialMonthlyData,
    currentPage, 
    expectedTotalOrders, 
    maxPages, 
    baseUrl, 
    timeFilter 
  } = scanData;
  
  let totalAmount = initialAmount;
  let totalOrderCount = initialCount;
  let allMonthlyData = initialMonthlyData || {};
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
      try {
        await chrome.tabs.sendMessage(originalTabId, {
          type: 'SCAN_UPDATE',
          data: {
            totalAmount,
            totalOrderCount,
            status: `Navigating to page ${pageNum}...`,
            currentPage: pageNum
          }
        });
      } catch (error) {
        console.log('Could not send update to original tab (may be closed)');
      }
      
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
          
          // Merge monthly data from this page
          if (pageResult.monthlyData) {
            for (const [month, data] of Object.entries(pageResult.monthlyData)) {
              if (!allMonthlyData[month]) {
                allMonthlyData[month] = { total: 0, count: 0 };
              }
              allMonthlyData[month].total += data.total;
              allMonthlyData[month].count += data.count;
            }
          }
          
          console.log(`Page ${pageNum}: $${pageResult.total} from ${pageResult.count} orders`);
          
          // Send update to original tab
          try {
            await chrome.tabs.sendMessage(originalTabId, {
              type: 'SCAN_UPDATE',
              data: {
                totalAmount,
                totalOrderCount,
                monthlyData: allMonthlyData,
                status: `Page ${pageNum} complete`,
                currentPage: pageNum
              }
            });
          } catch (error) {
            console.log('Could not send update to original tab (may be closed)');
          }
          
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
    try {
      await chrome.tabs.sendMessage(originalTabId, {
        type: 'SCAN_COMPLETE',
        data: {
          totalAmount,
          totalOrderCount,
          monthlyData: allMonthlyData,
          totalPages: pageNum
        }
      });
    } catch (error) {
      console.log('Could not send completion message to original tab (may be closed)');
    }
    
  } catch (error) {
    console.error('Tab navigation scan error:', error);
    try {
      await chrome.tabs.sendMessage(originalTabId, {
        type: 'SCAN_UPDATE',
        data: {
          totalAmount,
          totalOrderCount,
          status: `Error: ${error.message}`,
          currentPage: pageNum
        }
      });
    } catch (sendError) {
      console.log('Could not send error message to original tab (may be closed)');
    }
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
  const monthlyData = {};
  
  // Look for order containers first - prioritize more specific selectors
  const orderSelectors = [
    'li.order-card__list',
    '.order-card',
    '.a-box-group',
    '[class*="order"]',
    '[class*="shipment"]',
    '.a-card',
    '[data-testid*="order"]',
    '[class*="order-item"]'
  ];
  
  let orderElements = [];
  for (const selector of orderSelectors) {
    orderElements = document.querySelectorAll(selector);
    if (orderElements.length > 0) {
      console.log(`Found ${orderElements.length} elements with selector: ${selector}`);
      break;
    }
  }
  
  // If no specific order containers, look for elements containing "Order placed" or "Total"
  if (orderElements.length === 0) {
    const allElements = document.querySelectorAll('*');
    orderElements = Array.from(allElements).filter(el => {
      const text = el.textContent;
      // More specific filtering - must contain order-related text AND not be JavaScript
      return (text.includes('Order placed') || text.includes('Total')) && 
             !text.includes('var ') && 
             !text.includes('function') && 
             !text.includes('window.') &&
             !text.includes('Buy it again') &&
             !text.includes('Customers also bought') &&
             text.length < 1000; // Reasonable length for order text
    });
    console.log(`Found ${orderElements.length} potential order elements by content`);
  }
  
  // Process each order element
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    
    // Look for the specific "Total" element structure - try multiple patterns
    let totalElement = null;
    let totalText = '';
    
    // Pattern 1: Original specific structure
    totalElement = element.querySelector('.a-column.a-span2 .order-header__header-list-item .a-row:last-child .a-size-base');
    
    // Pattern 2: Alternative structure where amount is in any .a-row with .a-size-base
    if (!totalElement) {
      totalElement = element.querySelector('.a-column.a-span2 .order-header__header-list-item .a-row .a-size-base');
    }
    
    // Pattern 3: Look for any element with "Total" text and then find the amount
    if (!totalElement) {
      const totalLabel = element.querySelector('.a-column.a-span2 .order-header__header-list-item .a-row .a-text-caps');
      if (totalLabel && totalLabel.textContent.trim().toLowerCase().includes('total')) {
        // Find the amount in the next sibling row
        const nextRow = totalLabel.closest('.a-row').nextElementSibling;
        if (nextRow) {
          totalElement = nextRow.querySelector('.a-size-base');
        }
      }
    }
    
    // Pattern 4: Look for any .a-size-base that contains a dollar amount
    if (!totalElement) {
      const sizeBaseElements = element.querySelectorAll('.a-size-base');
      for (const el of sizeBaseElements) {
        if (el.textContent.match(/\$(\d+\.\d{2})/)) {
          totalElement = el;
          break;
        }
      }
    }
    
    if (totalElement) {
      totalText = totalElement.textContent.trim();
      const totalMatch = totalText.match(/\$(\d+\.\d{2})/);
      
      if (totalMatch) {
        const orderTotal = parseFloat(totalMatch[1]);
        
        // Only count if it's a reasonable order amount and we haven't seen it before
        if (orderTotal >= 0.01 && !processedAmounts.has(orderTotal)) {
          // Check for order text in the parent element
          const hasOrderText = text.includes('Order placed') || text.includes('Order #') || text.includes('Ordered');
          
          // Check for month names (expanded list) and extract date info
          const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
          const hasMonth = monthMatch !== null;
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            // Extract month and year for monthly tracking
            if (monthMatch) {
              const monthName = monthMatch[1];
              const year = monthMatch[3];
              const monthKey = `${monthName} ${year}`;
              
              if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { total: 0, count: 0 };
              }
              monthlyData[monthKey].total += orderTotal;
              monthlyData[monthKey].count += 1;
            }
            
            totalAmount += orderTotal;
            orderCount++;
            processedAmounts.add(orderTotal);
          }
        }
      }
    } else {
      // Fallback to old method if the specific structure isn't found
      const moneyMatches = text.match(/\$(\d+\.\d{2})/g);
      
      if (moneyMatches && moneyMatches.length > 0) {
        // Extract the largest amount (likely the order total)
        const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
        const maxAmount = Math.max(...amounts);
        
        // Only count if it's a reasonable order amount and we haven't seen it before
        if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
          // Check for order text
          const hasOrderText = text.includes('Order placed') || text.includes('Total') || text.includes('Order #');
          
          // Check for month names (expanded list) and extract date info
          const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
          const hasMonth = monthMatch !== null;
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            // Extract month and year for monthly tracking
            if (monthMatch) {
              const monthName = monthMatch[1];
              const year = monthMatch[3];
              const monthKey = `${monthName} ${year}`;
              
              if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { total: 0, count: 0 };
              }
              monthlyData[monthKey].total += maxAmount;
              monthlyData[monthKey].count += 1;
            }
            
            totalAmount += maxAmount;
            orderCount++;
            processedAmounts.add(maxAmount);
          }
        }
      }
    }
  });
  
  return { total: totalAmount, count: orderCount, monthlyData: monthlyData };
}