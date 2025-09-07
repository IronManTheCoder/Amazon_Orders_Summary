// content.js — Amazon order scanner for content script

function scanFirstPageOrders() {
  console.log('🔍 Scanning first page for orders...');
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set(); // Track unique amounts to avoid duplicates
  const monthlyData = {}; // Track spending by month
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
          
          // Check for month names (expanded list) and extract date info
          const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
          const hasMonth = monthMatch !== null;
          if (hasMonth) {
            debugInfo.elementsWithMonth++;
          }
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            debugInfo.elementsPassedAllChecks++;
            console.log(`✅ Found order total: $${orderTotal} in element:`, text.substring(0, 150));
            
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
              
              console.log(`📅 Added $${orderTotal} to ${monthKey}`);
            }
            
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
          
          // Check for month names (expanded list) and extract date info
          const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
          const hasMonth = monthMatch !== null;
          if (hasMonth) {
            debugInfo.elementsWithMonth++;
          }
          
          // Additional check: make sure this looks like an actual order
          if (hasOrderText && hasMonth) {
            debugInfo.elementsPassedAllChecks++;
            console.log(`✅ Found order amount (fallback): $${maxAmount} in element:`, text.substring(0, 150));
            
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
              
              console.log(`📅 Added $${maxAmount} to ${monthKey} (fallback)`);
            }
            
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
  console.log(`📅 Monthly breakdown:`, monthlyData);
  return { total: totalAmount, count: orderCount, monthlyData: monthlyData };
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
  const allMonthlyData = {}; // Collect monthly data from all pages
  
  while (currentPage <= maxPages) {
    console.log(`📄 Scanning page ${currentPage}...`);
    
    // Scan current page
    const pageResult = scanFirstPageOrders();
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
  console.log(`📅 All pages monthly data:`, allMonthlyData);
  return { total: totalAmount, count: totalOrderCount, pages: currentPage - 1, monthlyData: allMonthlyData };
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
      top: 50%;
      left: 20px;
      transform: translateY(-50%);
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
        <h3 style="margin: 0; color: #007185; font-size: 18px; font-weight: 600;">💰 Order Insights</h3>
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
      
      <!-- Chart Section -->
      <div id="chart-section" style="margin-bottom: 16px; display: none;">
        <div style="display: flex; justify-content: center; margin-bottom: 8px;">
          <button id="toggle-view" style="
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
            color: #495057;
          ">📊 Chart View</button>
        </div>

        <canvas id="monthly-chart" width="280" height="200" style="
          border: 1px solid #eee;
          border-radius: 6px;
          background: white;
          display: none;
        "></canvas>
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
        💡 Analyzes orders on the current page<br/>
        📊 Both options now support monthly charts
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(panel);
  
  // Get references to elements with null checks
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
  const chartSection = document.getElementById('chart-section');
  const toggleViewBtn = document.getElementById('toggle-view');
  const monthlyChart = document.getElementById('monthly-chart');
  
  // Verify critical elements exist
  if (!panelElement) {
    console.error('Dashboard panel element not found');
    return null;
  }
  
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
    { top: '50%', left: '20px', right: 'auto', bottom: 'auto', transform: 'translateY(-50%)' },
    { top: '50%', right: '20px', left: 'auto', bottom: 'auto', transform: 'translateY(-50%)' },
    { bottom: '20px', left: '20px', top: 'auto', right: 'auto', transform: 'none' },
    { bottom: '20px', right: '20px', top: 'auto', left: 'auto', transform: 'none' }
  ];
  
  if (positionBtn && panelElement) {
    positionBtn.addEventListener('click', () => {
      positionIndex = (positionIndex + 1) % positions.length;
      const pos = positions[positionIndex];
      panelElement.style.top = pos.top;
      panelElement.style.right = pos.right;
      panelElement.style.left = pos.left;
      panelElement.style.bottom = pos.bottom;
      panelElement.style.transform = pos.transform === 'none' ? 'translate(0, 0)' : pos.transform;
      xOffset = 0;
      yOffset = 0;
    });
  }
  
  // Button hover effects (with null checks)
  if (scanPageButton) {
    scanPageButton.addEventListener('mouseenter', () => {
      scanPageButton.style.backgroundColor = '#e68900';
    });
    scanPageButton.addEventListener('mouseleave', () => {
      scanPageButton.style.backgroundColor = '#FF9900';
    });
  }
  
  if (scanAllButton) {
    scanAllButton.addEventListener('mouseenter', () => {
      scanAllButton.style.backgroundColor = '#005f73';
    });
    scanAllButton.addEventListener('mouseleave', () => {
      scanAllButton.style.backgroundColor = '#007185';
    });
  }
  
  if (clearButton) {
    clearButton.addEventListener('mouseenter', () => {
      clearButton.style.backgroundColor = '#5a6268';
    });
    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.backgroundColor = '#6c757d';
    });
  }
  
  // Close button handler (with null check)
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      panel.remove();
    });
  }
  
  // Chart functionality
  let chartVisible = false;
  let currentMonthlyData = {};
  
  function drawMonthlyChart(monthlyData) {
    if (!monthlyData || Object.keys(monthlyData).length === 0) {
      return;
    }
    
    const ctx = monthlyChart.getContext('2d');
    const width = monthlyChart.width;
    const height = monthlyChart.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Sort months chronologically
    const sortedEntries = Object.entries(monthlyData).sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA - dateB;
    });
    
    if (sortedEntries.length === 0) return;
    
    // Calculate chart dimensions
    const leftPadding = 50; // Space for month labels
    const rightPadding = 70; // Space for values
    const topPadding = 20;
    const bottomPadding = 20;
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;
    
    // Find max value for scaling (horizontal bars)
    const maxValue = Math.max(...sortedEntries.map(([_, data]) => data.total));
    const scale = chartWidth / maxValue;
    
    // Draw bars (horizontal layout)
    const barSpacing = 4; // Spacing between bars
    const totalSpacing = barSpacing * (sortedEntries.length - 1);
    const barHeight = (chartHeight - totalSpacing) / sortedEntries.length;
    
    ctx.fillStyle = '#007185';
    ctx.font = '10px Arial';
    
    sortedEntries.forEach(([month, data], index) => {
      const y = topPadding + index * (barHeight + barSpacing);
      const barLength = data.total * scale;
      const x = leftPadding;
      
      // Draw bar (horizontal)
      ctx.fillStyle = '#007185';
      ctx.fillRect(x, y, barLength, barHeight);
      
      // Draw month label on the left
      ctx.fillStyle = '#333';
      ctx.textAlign = 'right';
      ctx.font = '11px Arial';
      const monthLabel = month.split(' ')[0].substring(0, 3);
      ctx.fillText(monthLabel, leftPadding - 5, y + barHeight / 2 + 4);
      
      // Draw value at the end of bar
      ctx.textAlign = 'left';
      ctx.font = '10px Arial';
      ctx.fillText(`$${data.total.toFixed(0)}`, x + barLength + 5, y + barHeight / 2 + 4);
    });
    
    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y-axis (left side)
    ctx.moveTo(leftPadding, topPadding);
    ctx.lineTo(leftPadding, height - bottomPadding);
    // X-axis (bottom)
    ctx.moveTo(leftPadding, height - bottomPadding);
    ctx.lineTo(width - rightPadding, height - bottomPadding);
    ctx.stroke();
  }
  
  // Toggle view button handler (with null check)
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      chartVisible = !chartVisible;
      if (chartVisible) {
        if (monthlyChart) monthlyChart.style.display = 'block';
        toggleViewBtn.textContent = '📈 Summary View';
        drawMonthlyChart(currentMonthlyData);
      } else {
        if (monthlyChart) monthlyChart.style.display = 'none';
        toggleViewBtn.textContent = '📊 Chart View';
      }
    });
  }
  
  
  
  return {
    update: (total, count, status, period, monthlyData) => {
      if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
      if (orderCountEl) orderCountEl.textContent = count;
      if (status && statusTextEl) {
        statusTextEl.textContent = status;
      }
      if (period && periodTextEl) {
        periodTextEl.textContent = period;
      }
      if (monthlyData) {
        currentMonthlyData = monthlyData;
        // Show toggle button only if we have monthly data
        if (toggleViewBtn) {
          if (Object.keys(monthlyData).length > 0) {
            console.log(`📊 Showing chart toggle button with ${Object.keys(monthlyData).length} months of data:`, monthlyData);
            // Show the chart section container
            if (chartSection) chartSection.style.display = 'block';
          } else {
            console.log(`📊 Hiding chart toggle button - no monthly data`);
            if (chartSection) {
              chartSection.style.display = 'none';
              chartVisible = false;
              if (monthlyChart) monthlyChart.style.display = 'none';
            }
          }
        } else {
          console.log(`📊 Toggle button element not found`);
        }
      }
      console.log(`Update: $${total} (${count} orders) - ${status} - ${period || 'N/A'}`);
    },
    onScanPage: (callback) => {
      if (scanPageButton) scanPageButton.addEventListener('click', callback);
    },
    onScanAll: (callback) => {
      if (scanAllButton) scanAllButton.addEventListener('click', callback);
    },
    onClear: (callback) => {
      if (clearButton) clearButton.addEventListener('click', callback);
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

  // Store monthly data for multi-page scans
  let storedMonthlyData = {};

  function runScan() {
    console.log('🚀 Starting calculation...');
    ui.update(0, 0, "Calculating...");
    
    try {
      const result = scanFirstPageOrders();
      ui.update(result.total, result.count, "Calculation complete", null, result.monthlyData);
      console.log(`✅ Calculation complete: $${result.total} from ${result.count} orders`);
    } catch (e) {
      console.error('Calculation error:', e);
      ui.update(0, 0, `Error: ${String(e)}`);
    }
  }

  function clearResults() {
    ui.update(0, 0, "Ready to calculate", null, {});
    console.log('🧹 Results cleared');
  }

  // Handle "All Pages" scanning using background script with monthly data
  function runAllPagesScan() {
    console.log('🚀 Starting all pages scan...');
    ui.update(0, 0, "Starting multi-page scan...");
    
    // Get current page data
    const currentResult = scanFirstPageOrders();
    const timePeriod = getSelectedTimePeriod();
    const baseUrl = window.location.origin + window.location.pathname;
    const timeFilter = new URLSearchParams(window.location.search).get('timeFilter') || 'all';
    
    // Initialize monthly data with first page data
    storedMonthlyData = currentResult.monthlyData || {};
    
    // Send message to background script to start multi-page scan
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'START_TAB_SCAN',
        data: {
          totalAmount: currentResult.total,
          totalOrderCount: currentResult.count,
          monthlyData: currentResult.monthlyData,
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
        // Update stored monthly data with the latest from background script
        if (msg.data.monthlyData) {
          storedMonthlyData = msg.data.monthlyData;
        }
        ui.update(msg.data.totalAmount, msg.data.totalOrderCount, msg.data.status, currentTimePeriod, storedMonthlyData);
      } else if (msg.type === 'SCAN_COMPLETE') {
        const currentTimePeriod = getSelectedTimePeriod();
        // Update stored monthly data with the final result
        if (msg.data.monthlyData) {
          storedMonthlyData = msg.data.monthlyData;
        }
        ui.update(msg.data.totalAmount, msg.data.totalOrderCount, "Scan complete!", currentTimePeriod, storedMonthlyData);
        console.log(`✅ All pages scan complete: $${msg.data.totalAmount} from ${msg.data.totalOrderCount} orders across ${msg.data.totalPages} pages`);
        console.log(`📅 Complete monthly breakdown:`, storedMonthlyData);
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