// content.js — Amazon order scanner for content script

function scanFirstPageOrders() {
  console.log('🔍 Scanning first page for orders...');
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set(); // Track unique amounts to avoid duplicates
  const debugInfo = {
    totalElements: 0,
    elementsWithMoney: 0,
    elementsWithOrderText: 0,
    elementsWithMonth: 0,
    elementsPassedAllChecks: 0,
    skippedReasons: {
      noMoney: 0,
      duplicateAmount: 0,
      noOrderText: 0,
      noMonth: 0,
      tooSmall: 0,
      javascript: 0
    }
  };
  
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
  
  debugInfo.totalElements = orderElements.length;
  
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    
    // Skip JavaScript elements
    // if (text.includes('window.uet') || text.includes('performance.mark') || 
    //     text.includes('function(') || text.length < 50) {
    //   debugInfo.skippedReasons.javascript++;
    //   console.log(`❌ Skipped - JavaScript:`, text.substring(0, 100));
    //   return;
    // }
    
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
    
    // Pattern 5: Handle the specific structure with additional classes (a-color-secondary, aok-break-word)
    if (!totalElement) {
      totalElement = element.querySelector('.a-column.a-span2 .order-header__header-list-item .a-row .a-size-base.a-color-secondary.aok-break-word');
    }
    
    // Pattern 6: More flexible search for total elements with any combination of classes
    if (!totalElement) {
      const totalElements = element.querySelectorAll('.a-column.a-span2 .order-header__header-list-item .a-row .a-size-base');
      for (const el of totalElements) {
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
        debugInfo.elementsWithMoney++;
        
        // Only count if it's a reasonable order amount and we haven't seen it before
        if (orderTotal >= 0.01 && !processedAmounts.has(orderTotal)) {
          // Check for order text in the parent element
          const hasOrderText = text.includes('Order placed') || text.includes('Order #') || text.includes('Ordered');
          if (hasOrderText) {
            debugInfo.elementsWithOrderText++;
          }
          
          // Debug logging for duplicate detection
          if (processedAmounts.has(orderTotal)) {
            console.log(`🔄 Duplicate amount detected: $${orderTotal} - skipping`);
          }
          
          // Check for month names (expanded list)
          const hasMonth = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(text);
          if (hasMonth) {
            debugInfo.elementsWithMonth++;
          }
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            debugInfo.elementsPassedAllChecks++;
            console.log(`✅ Found order total: $${orderTotal} in element:`, text.substring(0, 150));
            totalAmount += orderTotal;
            orderCount++;
            processedAmounts.add(orderTotal);
          } else {
            if (!hasOrderText) {
              debugInfo.skippedReasons.noOrderText++;
              console.log(`❌ Skipped $${orderTotal} - No order text:`, text.substring(0, 100));
            }
            if (!hasMonth) {
              debugInfo.skippedReasons.noMonth++;
              console.log(`❌ Skipped $${orderTotal} - No month:`, text.substring(0, 100));
            }
          }
          
          } else {
          if (orderTotal < 0.01) {
            debugInfo.skippedReasons.tooSmall++;
          }
          if (processedAmounts.has(orderTotal)) {
            debugInfo.skippedReasons.duplicateAmount++;
          }
        }
      } else {
        debugInfo.skippedReasons.noMoney++;
      }
    } else {
      // Fallback to old method if the specific structure isn't found
      const moneyMatches = text.match(/\$(\d+\.\d{2})/g);
      
      if (moneyMatches && moneyMatches.length > 0) {
        debugInfo.elementsWithMoney++;
        
        // Extract the largest amount (likely the order total)
        const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
        const maxAmount = Math.max(...amounts);
        
        // Only count if it's a reasonable order amount and we haven't seen it before
        if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
          // Check for order text
          const hasOrderText = text.includes('Order placed') || text.includes('Total') || text.includes('Order #');
          if (hasOrderText) {
            debugInfo.elementsWithOrderText++;
          }
          
          // Check for month names (expanded list)
          const hasMonth = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(text);
          if (hasMonth) {
            debugInfo.elementsWithMonth++;
          }
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            debugInfo.elementsPassedAllChecks++;
            console.log(`✅ Found order amount (fallback): $${maxAmount} in element:`, text.substring(0, 150));
            totalAmount += maxAmount;
            orderCount++;
            processedAmounts.add(maxAmount);
          } else {
            if (!hasOrderText) {
              debugInfo.skippedReasons.noOrderText++;
              console.log(`❌ Skipped $${maxAmount} - No order text:`, text.substring(0, 100));
            }
            if (!hasMonth) {
              debugInfo.skippedReasons.noMonth++;
              console.log(`❌ Skipped $${maxAmount} - No month:`, text.substring(0, 100));
            }
          }
          
        } else {
          if (maxAmount < 0.01) {
            debugInfo.skippedReasons.tooSmall++;
          }
          if (processedAmounts.has(maxAmount)) {
            debugInfo.skippedReasons.duplicateAmount++;
          }
        }
      } else {
        debugInfo.skippedReasons.noMoney++;
      }
    }
  });
  
  // Enhanced logging
  console.log('📊 DEBUG INFO:');
  console.log(`  Total elements scanned: ${debugInfo.totalElements}`);
  console.log(`  Elements with money: ${debugInfo.elementsWithMoney}`);
  console.log(`  Elements with order text: ${debugInfo.elementsWithOrderText}`);
  console.log(`  Elements with month: ${debugInfo.elementsWithMonth}`);
  console.log(`  Elements passed all checks: ${debugInfo.elementsPassedAllChecks}`);
  console.log('📊 SKIPPED REASONS:');
  console.log(`  No money: ${debugInfo.skippedReasons.noMoney}`);
  console.log(`  Duplicate amount: ${debugInfo.skippedReasons.duplicateAmount}`);
  console.log(`  No order text: ${debugInfo.skippedReasons.noOrderText}`);
  console.log(`  No month: ${debugInfo.skippedReasons.noMonth}`);
  console.log(`  Too small: ${debugInfo.skippedReasons.tooSmall}`);
  console.log(`  JavaScript: ${debugInfo.skippedReasons.javascript}`);
  
  // Additional debugging to understand why we might be missing orders
  console.log(`🔍 ADDITIONAL DEBUG:
    Processed amounts: [${Array.from(processedAmounts).join(', ')}]
    Order elements found: ${orderElements.length}
    Elements with money (debug): ${debugInfo.elementsWithMoney}
    Elements passed all checks (debug): ${debugInfo.elementsPassedAllChecks}
  `);
  
  // Debug: Show which elements don't have money
  console.log('🔍 ELEMENTS WITHOUT MONEY:');
  let elementsWithoutMoney = 0;
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    const hasMoney = text.match(/\$(\d+\.\d{2})/);
    if (!hasMoney) {
      elementsWithoutMoney++;
      console.log(`  Element ${index + 1} (no money):`, text.substring(0, 200));
      console.log(`  Classes: ${element.className}`);
      console.log(`  Tag: ${element.tagName}`);
    }
  });
  console.log(`  Total elements without money: ${elementsWithoutMoney}`);
  
  console.log(`📊 First page results: $${totalAmount.toFixed(2)} from ${orderCount} orders`);
  return { total: totalAmount, count: orderCount };
}

// Get the selected time period from the dropdown
function getSelectedTimePeriod() {
  // Look for the dropdown that shows time periods
  const dropdownSelectors = [
    'select[name*="time"]',
    'select[class*="time"]',
    '.a-dropdown-container select',
    'select option:checked'
  ];
  
  for (const selector of dropdownSelectors) {
    const dropdown = document.querySelector(selector);
    if (dropdown) {
      const selectedOption = dropdown.options[dropdown.selectedIndex];
      if (selectedOption) {
        return selectedOption.textContent.trim();
      }
    }
  }
  
  // Fallback: look for text that indicates time period
  const timeText = document.querySelector('[class*="time"], [class*="period"]');
  if (timeText) {
    return timeText.textContent.trim();
  }
  
  // Look for common time period text in the page
  const timePatterns = [
    /(\d+\s+orders?\s+placed\s+in\s+[^<]+)/i,
    /(last\s+\d+\s+days?)/i,
    /(past\s+\d+\s+months?)/i,
    /(20\d{2})/i
  ];
  
  for (const pattern of timePatterns) {
    const match = document.body.textContent.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return "All Orders"; // Default fallback
}

// Find the next page link
function findNextPageLink() {
  const nextSelectors = [
    'a[aria-label*="Next"]',
    'a[title*="Next"]',
    '.a-pagination .a-last a',
    '.a-pagination-next',
    'a[class*="next"]',
    'a[class*="pagination"]'
  ];
  
  for (const selector of nextSelectors) {
    const link = document.querySelector(selector);
    if (link && link.href && !link.disabled) {
      return link.href;
    }
  }
  
  // Look for pagination links with numbers
  const paginationLinks = document.querySelectorAll('.a-pagination a, [class*="pagination"] a');
  for (const link of paginationLinks) {
    if (link.textContent.match(/\d+/) && link.href) {
      return link.href;
    }
  }
  
  return null;
}

// Scan all pages of orders
async function scanAllPagesOrders() {
  console.log('🚀 Starting comprehensive scan of all pages...');
  
  let totalAmount = 0;
  let totalOrderCount = 0;
  let currentPage = 1;
  const maxPages = 20; // Safety limit to prevent infinite loops
  const processedPages = new Set();
  
  while (currentPage <= maxPages) {
    console.log(`📄 Scanning page ${currentPage}...`);
    
    // Scan current page
    const pageResult = scanFirstPageOrders();
    totalAmount += pageResult.total;
    totalOrderCount += pageResult.count;
    
    // Check if we've already processed this page (avoid infinite loops)
    const currentUrl = window.location.href;
    if (processedPages.has(currentUrl)) {
      console.log('Already processed this page, stopping...');
      break;
    }
    processedPages.add(currentUrl);
    
    // Look for next page
    const nextPageLink = findNextPageLink();
    if (!nextPageLink) {
      console.log('No next page found, scan complete');
          break;
        }
        
    // Navigate to next page
    console.log(`➡️ Navigating to next page: ${nextPageLink}`);
    window.location.href = nextPageLink;
    
    // Wait for page to load
    await new Promise(resolve => {
      const checkLoaded = () => {
        if (document.readyState === 'complete') {
          setTimeout(resolve, 2000); // Wait for content to load
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    });
    
    currentPage++;
  }
  
  console.log(`✅ Scan complete: $${totalAmount.toFixed(2)} from ${totalOrderCount} orders across ${currentPage - 1} pages`);
  return { total: totalAmount, count: totalOrderCount, pages: currentPage - 1 };
}

function injectPanel() {
  // Create and inject the UI panel
  const panelId = 'amazon-spend-dashboard';
  
  // Remove existing panel if it exists
  const existingPanel = document.getElementById(panelId);
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Create the panel
  const panel = document.createElement('div');
  panel.id = panelId;
  panel.innerHTML = `
    <div id="dashboard-panel" style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      background: white;
      border: 2px solid #007185;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      cursor: move;
      user-select: none;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #007185; font-size: 18px; font-weight: 600;">💰 Order Calculator</h3>
        <div style="display: flex; gap: 8px;">
          <button id="position-btn" style="
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            color: #666;
          ">📍</button>
          <button id="close-panel" style="
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
          ">×</button>
        </div>
      </div>
      
      <div id="spend-display" style="margin-bottom: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #B12704; margin-bottom: 4px;">
          $<span id="total-amount">0.00</span>
        </div>
        <div style="color: #666; font-size: 14px; margin-bottom: 4px;">
          <span id="order-count">0</span> orders
        </div>
        <div id="time-period" style="color: #007185; font-size: 12px; font-weight: 500; margin-bottom: 8px;">
          <span id="period-text">All Orders</span>
        </div>
        <div id="status-text" style="color: #28a745; font-size: 12px; font-weight: 500;">
          Ready to calculate
        </div>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button id="scan-page-button" style="
          flex: 1;
          background: #FF9900;
          color: white;
          border: none;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: background-color 0.2s;
        ">This Page</button>
        <button id="scan-all-button" style="
          flex: 1;
          background: #007185;
          color: white;
          border: none;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: background-color 0.2s;
        ">All Pages</button>
      </div>
      
      
      
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <button id="clear-button" style="
          flex: 1;
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: background-color 0.2s;
        ">Reset</button>
      </div>
      
      <div style="font-size: 11px; color: #666; line-height: 1.4; text-align: center;">
        💡 Analyzes orders on the current page
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(panel);
  
  // Get references to elements
  const totalAmountEl = document.getElementById('total-amount');
  const orderCountEl = document.getElementById('order-count');
  const statusTextEl = document.getElementById('status-text');
  const periodTextEl = document.getElementById('period-text');
  const scanPageButton = document.getElementById('scan-page-button');
  const scanAllButton = document.getElementById('scan-all-button');
  const clearButton = document.getElementById('clear-button');
  const closeButton = document.getElementById('close-panel');
  const positionBtn = document.getElementById('position-btn');
  const panelElement = document.getElementById('dashboard-panel');
  
  // Make panel draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  panelElement.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
  
  function dragStart(e) {
    if (e.target.id === 'close-panel' || e.target.id === 'position-btn' || 
        e.target.id === 'scan-button' || e.target.id === 'clear-button') {
      return;
    }
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === panelElement || panelElement.contains(e.target)) {
      isDragging = true;
    }
  }
  
  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      xOffset = currentX;
      yOffset = currentY;
      
      panelElement.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }
  
  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
  
  // Position button - cycle through corners
  let positionIndex = 0;
  const positions = [
    { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
    { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
    { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
    { bottom: '20px', left: '20px', top: 'auto', right: 'auto' }
  ];
  
  positionBtn.addEventListener('click', () => {
    positionIndex = (positionIndex + 1) % positions.length;
    const pos = positions[positionIndex];
    panelElement.style.top = pos.top;
    panelElement.style.right = pos.right;
    panelElement.style.left = pos.left;
    panelElement.style.bottom = pos.bottom;
    panelElement.style.transform = 'translate(0, 0)';
    xOffset = 0;
    yOffset = 0;
  });
  
  // Button hover effects
  scanPageButton.addEventListener('mouseenter', () => {
    scanPageButton.style.backgroundColor = '#e68900';
  });
  scanPageButton.addEventListener('mouseleave', () => {
    scanPageButton.style.backgroundColor = '#FF9900';
  });
  
  scanAllButton.addEventListener('mouseenter', () => {
    scanAllButton.style.backgroundColor = '#005f73';
  });
  scanAllButton.addEventListener('mouseleave', () => {
    scanAllButton.style.backgroundColor = '#007185';
  });
  
  clearButton.addEventListener('mouseenter', () => {
    clearButton.style.backgroundColor = '#5a6268';
  });
  clearButton.addEventListener('mouseleave', () => {
    clearButton.style.backgroundColor = '#6c757d';
  });
  
  // Close button handler
  closeButton.addEventListener('click', () => {
    panel.remove();
  });
  
  
  
  return {
    update: (total, count, status, period) => {
      totalAmountEl.textContent = total.toFixed(2);
      orderCountEl.textContent = count;
      if (status) {
        statusTextEl.textContent = status;
      }
      if (period) {
        periodTextEl.textContent = period;
      }
      console.log(`Update: $${total} (${count} orders) - ${status} - ${period || 'N/A'}`);
    },
    onScanPage: (callback) => {
      scanPageButton.addEventListener('click', callback);
    },
    onScanAll: (callback) => {
      scanAllButton.addEventListener('click', callback);
    },
    onClear: (callback) => {
      clearButton.addEventListener('click', callback);
    }
  };
}

// Main execution
function main() {
  // Check if panel already exists
  const existingPanel = document.getElementById('amazon-spend-dashboard');
  if (existingPanel) {
    console.log('Panel already exists, updating...');
        return;
      }
      
  const ui = injectPanel();

  // Initialize with ready state
  ui.update(0, 0, "Ready");

  function runScan() {
    console.log('🚀 Starting calculation...');
    ui.update(0, 0, "Calculating...");
    
    try {
      const result = scanFirstPageOrders();
      ui.update(result.total, result.count, "Calculation complete");
      console.log(`✅ Calculation complete: $${result.total} from ${result.count} orders`);
    } catch (e) {
      console.error('Calculation error:', e);
      ui.update(0, 0, `Error: ${String(e)}`);
    }
  }

  function clearResults() {
    ui.update(0, 0, "Ready to calculate");
    console.log('🧹 Results cleared');
  }

  // Handle "All Pages" scanning using background script
  function runAllPagesScan() {
    console.log('🚀 Starting all pages scan...');
    ui.update(0, 0, "Starting multi-page scan...");
    
    // Get current page data
    const currentResult = scanFirstPageOrders();
    const timePeriod = getSelectedTimePeriod();
    const baseUrl = window.location.origin + window.location.pathname;
    const timeFilter = new URLSearchParams(window.location.search).get('timeFilter') || 'all';
    
    // Send message to background script to start multi-page scan
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'START_TAB_SCAN',
        data: {
          totalAmount: currentResult.total,
          totalOrderCount: currentResult.count,
          currentPage: 1,
          expectedTotalOrders: null,
          maxPages: 20,
          baseUrl: baseUrl,
          timeFilter: timeFilter
        }
      });
    } else {
      console.error('Chrome runtime not available');
      ui.update(0, 0, "Error: Extension not available");
    }
  }

  // Listen for messages from background script
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'SCAN_UPDATE') {
        const currentTimePeriod = getSelectedTimePeriod();
        ui.update(msg.data.totalAmount, msg.data.totalOrderCount, msg.data.status, currentTimePeriod);
      } else if (msg.type === 'SCAN_COMPLETE') {
        const currentTimePeriod = getSelectedTimePeriod();
        ui.update(msg.data.totalAmount, msg.data.totalOrderCount, "Scan complete!", currentTimePeriod);
        console.log(`✅ All pages scan complete: $${msg.data.totalAmount} from ${msg.data.totalOrderCount} orders across ${msg.data.totalPages} pages`);
      }
    });
  }

  ui.onScanPage(runScan);
  ui.onScanAll(runAllPagesScan);
  ui.onClear(clearResults);
}

// Run when page loads
main();

// Function to ensure panel exists
function ensurePanelExists() {
  const existingPanel = document.getElementById('amazon-spend-dashboard');
  if (!existingPanel) {
    console.log('Panel missing, recreating...');
    main();
  }
}

// Listen for navigation events
window.addEventListener('popstate', () => {
  console.log('Navigation detected (popstate)');
  setTimeout(ensurePanelExists, 1000);
});

// Listen for hash changes
window.addEventListener('hashchange', () => {
  console.log('Hash change detected');
  setTimeout(ensurePanelExists, 1000);
});

// Also run when the page content changes (for SPA navigation)
const observer = new MutationObserver((mutations) => {
  const hasNewContent = mutations.some(mutation => 
    mutation.type === 'childList' && 
    mutation.addedNodes.length > 0 &&
    Array.from(mutation.addedNodes).some(node => 
      node.nodeType === Node.ELEMENT_NODE && 
      (node.classList?.contains('a-box-group') || 
       node.querySelector?.('.a-box-group'))
    )
  );
  
  if (hasNewContent) {
    console.log('New content detected, ensuring panel exists...');
    setTimeout(ensurePanelExists, 500); // Small delay to let content load
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Periodic check to ensure panel exists (fallback)
setInterval(ensurePanelExists, 5000);