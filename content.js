// content.js — Simple Amazon order scanner for first page only

function scanFirstPageOrders() {
  console.log('🔍 Scanning first page for orders...');
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set(); // Track unique amounts to avoid duplicates
  
  // Look for order containers first
  const orderSelectors = [
    '.a-box-group',
    '[class*="order"]',
    '[class*="shipment"]',
    '.a-card'
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
  
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    
    // Look for dollar amounts in the text
    const moneyMatches = text.match(/\$(\d+(?:\.\d{2})?)/g);
    
    if (moneyMatches && moneyMatches.length > 0) {
      // Extract the largest amount (likely the order total)
      const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
      const maxAmount = Math.max(...amounts);
      
      // Only count if it's a reasonable order amount and we haven't seen it before
      if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
        // Additional check: make sure this looks like an actual order
        // Must contain "Order placed" AND "Total" AND a month name
        if (text.includes('Order placed') && 
            text.includes('Total') && 
            (text.includes('Aug') || text.includes('Sep') || text.includes('Jul'))) {
          console.log(`Found order amount: $${maxAmount} in element:`, text.substring(0, 150));
          totalAmount += maxAmount;
          orderCount++;
          processedAmounts.add(maxAmount);
        }
      }
    }
  });
  
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
  console.log('🔍 Looking for next page link...');
  
  const nextSelectors = [
    'a[aria-label*="Next"]',
    'a[title*="Next"]',
    '.a-pagination .a-last a',
    '.a-pagination-next',
    'a[class*="next"]',
    'a[class*="pagination"]',
    'a[aria-label*="next"]',
    'a[title*="next"]'
  ];
  
  for (const selector of nextSelectors) {
    const link = document.querySelector(selector);
    if (link && link.href && !link.disabled) {
      console.log(`Found next page link with selector: ${selector} -> ${link.href}`);
      return link.href;
    }
  }
  
  // Look for pagination links with numbers (higher page numbers)
  const paginationLinks = document.querySelectorAll('.a-pagination a, [class*="pagination"] a, a[href*="startIndex"]');
  console.log(`Found ${paginationLinks.length} pagination links`);
  
  let highestPageUrl = null;
  let highestPageNum = 0;
  
  for (const link of paginationLinks) {
    const text = link.textContent.trim();
    const href = link.href;
    
    console.log(`Checking link: "${text}" -> ${href}`);
    
    // Look for page numbers in text
    const pageMatch = text.match(/(\d+)/);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1]);
      if (pageNum > highestPageNum) {
        highestPageNum = pageNum;
        highestPageUrl = href;
      }
    }
    
    // Also check for "Next" text
    if (text.toLowerCase().includes('next') && href) {
      console.log(`Found "Next" link: ${href}`);
      return href;
    }
  }
  
  // Look for startIndex parameter in URLs (Amazon pagination)
  const startIndexLinks = document.querySelectorAll('a[href*="startIndex"]');
  console.log(`Found ${startIndexLinks.length} startIndex links`);
  
  for (const link of startIndexLinks) {
    const href = link.href;
    const startIndexMatch = href.match(/startIndex=(\d+)/);
    if (startIndexMatch) {
      const startIndex = parseInt(startIndexMatch[1]);
      console.log(`Found startIndex link: ${href} (index: ${startIndex})`);
      return href;
    }
  }
  
  if (highestPageUrl) {
    console.log(`Using highest page number link: ${highestPageUrl}`);
    return highestPageUrl;
  }
  
  console.log('No next page link found');
  return null;
}

// Scan all pages of orders using fetch (no page refresh)
async function scanAllPagesOrders(updateCallback) {
  console.log('🚀 Starting comprehensive scan of all pages...');
  
  let totalAmount = 0;
  let totalOrderCount = 0;
  let currentPage = 1;
  const maxPages = 20; // Safety limit to prevent infinite loops
  const processedUrls = new Set();
  
  // Store the current page results first
  const currentPageResult = scanFirstPageOrders();
  totalAmount += currentPageResult.total;
  totalOrderCount += currentPageResult.count;
  processedUrls.add(window.location.href);
  
  console.log(`📄 Page ${currentPage}: $${currentPageResult.total} from ${currentPageResult.count} orders`);
  
  // Update UI with first page results
  if (updateCallback) {
    updateCallback(totalAmount, totalOrderCount, `Page ${currentPage} complete`);
  }
  
  // Try to find and scan additional pages
  let nextPageUrl = findNextPageLink();
  
  while (nextPageUrl && currentPage < maxPages && !processedUrls.has(nextPageUrl)) {
    currentPage++;
    console.log(`📄 Scanning page ${currentPage}...`);
    
    // Update UI with scanning status
    if (updateCallback) {
      updateCallback(totalAmount, totalOrderCount, `Scanning page ${currentPage}...`);
    }
    
    try {
      // Fetch the next page content with proper headers
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent': navigator.userAgent
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch page ${currentPage}: ${response.status}`);
        break;
      }
      
      const html = await response.text();
      
      // Create a temporary DOM to parse the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Scan the fetched page for orders
      const pageResult = scanPageFromDocument(doc);
      totalAmount += pageResult.total;
      totalOrderCount += pageResult.count;
      
      console.log(`📄 Page ${currentPage}: $${pageResult.total} from ${pageResult.count} orders`);
      
      // Update UI with current progress
      if (updateCallback) {
        updateCallback(totalAmount, totalOrderCount, `Page ${currentPage} complete`);
      }
      
      // Look for the next page in the fetched content
      console.log('🔍 Looking for next page in fetched content...');
      
      const nextPageSelectors = [
        'a[aria-label*="Next"]',
        'a[title*="Next"]',
        '.a-pagination .a-last a',
        '.a-pagination-next',
        'a[class*="next"]',
        'a[class*="pagination"]',
        'a[aria-label*="next"]',
        'a[title*="next"]'
      ];
      
      let foundNext = false;
      for (const selector of nextPageSelectors) {
        const link = doc.querySelector(selector);
        if (link && link.href && !link.disabled) {
          console.log(`Found next page link in fetched content: ${selector} -> ${link.href}`);
          nextPageUrl = link.href;
          foundNext = true;
          break;
        }
      }
      
      if (!foundNext) {
        // Look for pagination links with numbers and startIndex
        const paginationLinks = doc.querySelectorAll('.a-pagination a, [class*="pagination"] a, a[href*="startIndex"]');
        console.log(`Found ${paginationLinks.length} pagination links in fetched content`);
        
        let highestPageUrl = null;
        let highestStartIndex = 0;
        
        for (const link of paginationLinks) {
          const text = link.textContent.trim();
          const href = link.href;
          
          console.log(`Checking fetched link: "${text}" -> ${href}`);
          
          // Check for startIndex parameter
          const startIndexMatch = href.match(/startIndex=(\d+)/);
          if (startIndexMatch) {
            const startIndex = parseInt(startIndexMatch[1]);
            if (startIndex > highestStartIndex && !processedUrls.has(href)) {
              highestStartIndex = startIndex;
              highestPageUrl = href;
            }
          }
          
          // Check for "Next" text
          if (text.toLowerCase().includes('next') && href && !processedUrls.has(href)) {
            console.log(`Found "Next" link in fetched content: ${href}`);
            nextPageUrl = href;
            foundNext = true;
            break;
          }
        }
        
        if (!foundNext && highestPageUrl) {
          console.log(`Using highest startIndex link from fetched content: ${highestPageUrl}`);
          nextPageUrl = highestPageUrl;
          foundNext = true;
        }
      }
      
      if (!foundNext) {
        // Try to construct next page URL with incremented startIndex
        const currentUrl = new URL(window.location.href);
        const currentStartIndex = parseInt(currentUrl.searchParams.get('startIndex') || '0');
        const nextStartIndex = currentStartIndex + 20; // Amazon typically shows 20 orders per page
        
        // Construct next page URL
        const nextUrl = new URL(currentUrl);
        nextUrl.searchParams.set('startIndex', nextStartIndex.toString());
        const constructedNextUrl = nextUrl.toString();
        
        console.log(`Trying constructed next page URL: ${constructedNextUrl}`);
        
        // Test if this URL would return content
        try {
          const testResponse = await fetch(constructedNextUrl, {
            method: 'HEAD',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'User-Agent': navigator.userAgent
            },
            credentials: 'include'
          });
          
          if (testResponse.ok) {
            nextPageUrl = constructedNextUrl;
            foundNext = true;
            console.log(`Constructed URL is valid: ${constructedNextUrl}`);
          } else {
            console.log(`Constructed URL returned ${testResponse.status}, stopping scan`);
            break;
          }
        } catch (error) {
          console.log(`Error testing constructed URL: ${error.message}`);
          break;
        }
      }
      
      if (!foundNext) {
        console.log('No next page found, scan complete');
        break;
      }
      
      processedUrls.add(nextPageUrl);
      
      // Add a small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      break;
    }
  }
  
  console.log(`✅ Scan complete: $${totalAmount.toFixed(2)} from ${totalOrderCount} orders across ${currentPage} pages`);
  return { total: totalAmount, count: totalOrderCount, pages: currentPage };
}

// Scan orders from a document (used for fetched pages)
function scanPageFromDocument(doc) {
  console.log('🔍 Scanning fetched document for orders...');
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set();
  
  // Look for order containers first
  const orderSelectors = [
    '.a-box-group',
    '[class*="order"]',
    '[class*="shipment"]',
    '.a-card'
  ];
  
  let orderElements = [];
  for (const selector of orderSelectors) {
    orderElements = doc.querySelectorAll(selector);
    if (orderElements.length > 0) {
      console.log(`Found ${orderElements.length} elements with selector: ${selector}`);
      break;
    }
  }
  
  // If no specific order containers, look for elements containing "Order placed" or "Total"
  if (orderElements.length === 0) {
    const allElements = doc.querySelectorAll('*');
    orderElements = Array.from(allElements).filter(el => {
      const text = el.textContent;
      return (text.includes('Order placed') || text.includes('Total')) &&
             !text.includes('var ') &&
             !text.includes('function') &&
             !text.includes('window.') &&
             !text.includes('Buy it again') &&
             !text.includes('Customers also bought') &&
             text.length < 1000;
    });
    console.log(`Found ${orderElements.length} potential order elements by content`);
  }
  
  // Also try to find order elements by looking for specific Amazon order patterns
  if (orderElements.length === 0) {
    const orderPatterns = [
      'div[data-testid*="order"]',
      'div[class*="order-item"]',
      'div[class*="order-card"]',
      'div[class*="shipment"]'
    ];
    
    for (const pattern of orderPatterns) {
      orderElements = doc.querySelectorAll(pattern);
      if (orderElements.length > 0) {
        console.log(`Found ${orderElements.length} elements with pattern: ${pattern}`);
        break;
      }
    }
  }
  
  console.log(`Processing ${orderElements.length} order elements...`);
  
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    
    // Look for dollar amounts in the text
    const moneyMatches = text.match(/\$(\d+(?:\.\d{2})?)/g);
    
    if (moneyMatches && moneyMatches.length > 0) {
      const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
      const maxAmount = Math.max(...amounts);
      
      if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
        // More flexible order detection for fetched content
        const hasOrderText = text.includes('Order placed') || text.includes('Total') || text.includes('Order #');
        const hasMonth = text.includes('Aug') || text.includes('Sep') || text.includes('Jul') || 
                        text.includes('Jan') || text.includes('Feb') || text.includes('Mar') ||
                        text.includes('Apr') || text.includes('May') || text.includes('Jun') ||
                        text.includes('Oct') || text.includes('Nov') || text.includes('Dec');
        
        if (hasOrderText && hasMonth) {
          console.log(`Found order amount: $${maxAmount} in element:`, text.substring(0, 150));
          totalAmount += maxAmount;
          orderCount++;
          processedAmounts.add(maxAmount);
        }
      }
    }
  });
  
  console.log(`📊 Fetched page results: $${totalAmount.toFixed(2)} from ${orderCount} orders`);
  return { total: totalAmount, count: orderCount };
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
        💡 "This Page" scans current page only<br>
        "All Pages" scans all pages automatically
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

  // Get the selected time period
  const timePeriod = getSelectedTimePeriod();
  console.log('Detected time period:', timePeriod);

  // Initialize with ready state
  ui.update(0, 0, "Ready", timePeriod);

  function runScanPage() {
    console.log('🚀 Starting page calculation...');
    ui.update(0, 0, "Calculating this page...", timePeriod);
    
    try {
      const result = scanFirstPageOrders();
      ui.update(result.total, result.count, "Page complete", timePeriod);
      console.log(`✅ Page calculation complete: $${result.total} from ${result.count} orders`);
    } catch (e) {
      console.error('Calculation error:', e);
      ui.update(0, 0, `Error: ${String(e)}`, timePeriod);
    }
  }

  async function runScanAll() {
    console.log('🚀 Starting comprehensive calculation...');
    ui.update(0, 0, "Scanning all pages...", timePeriod);
    
    try {
      // Create update callback for real-time updates
      const updateCallback = (total, count, status) => {
        ui.update(total, count, status, timePeriod);
      };
      
      const result = await scanAllPagesOrders(updateCallback);
      ui.update(result.total, result.count, `Complete (${result.pages} pages)`, timePeriod);
      console.log(`✅ Comprehensive scan complete: $${result.total} from ${result.count} orders across ${result.pages} pages`);
} catch (e) {
      console.error('Comprehensive scan error:', e);
      ui.update(0, 0, `Error: ${String(e)}`, timePeriod);
    }
  }

  function clearResults() {
    ui.update(0, 0, "Ready to calculate", timePeriod);
    console.log('🧹 Results cleared');
  }

  ui.onScanPage(runScanPage);
  ui.onScanAll(runScanAll);
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