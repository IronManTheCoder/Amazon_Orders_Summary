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
            (text.includes('Jan') || text.includes('Feb') || text.includes('Mar') || 
             text.includes('Apr') || text.includes('May') || text.includes('Jun') ||
             text.includes('Jul') || text.includes('Aug') || text.includes('Sep') || 
             text.includes('Oct') || text.includes('Nov') || text.includes('Dec'))) {
          console.log(`Found order amount: $${maxAmount} in element:`, text.substring(0, 150));
          totalAmount += maxAmount;
          orderCount++;
          processedAmounts.add(maxAmount);
        }
      }
    }
  });
  
  console.log(`📊 First page results: $${totalAmount.toFixed(2)} from ${orderCount} orders`);
  
  // Additional check: if we're on an orders page but found no orders, check if page indicates no orders
  if (orderCount === 0) {
    const pageText = document.body.textContent.toLowerCase();
    if (pageText.includes('no orders') || pageText.includes('0 orders') || 
        pageText.includes('no items') || pageText.includes('nothing here')) {
      console.log('⚠️ Page indicates no orders available');
    }
  }
  
  return { total: totalAmount, count: orderCount };
}

// Scan orders directly from HTML string (fallback method)
function scanOrdersFromHTML(html) {
  console.log('🔍 Scanning orders directly from HTML...');
  
  let totalAmount = 0;
  let orderCount = 0;
  const processedAmounts = new Set();
  
  // Look for order patterns in the raw HTML
  // Pattern 1: Look for order total patterns in visible text
  const orderTotalPatterns = [
    /Order\s+total[^$]*\$(\d+\.\d{2})/gi,
    /Total[^$]*\$(\d+\.\d{2})/gi,
    /Grand\s+total[^$]*\$(\d+\.\d{2})/gi,
    /"orderTotal"[^$]*\$(\d+\.\d{2})/gi,
    /"total"[^$]*\$(\d+\.\d{2})/gi
  ];
  
  // Pattern 2: Look for structured order data in JSON/JavaScript
  const structuredPatterns = [
    /"price":\s*"?\$?(\d+\.\d{2})"?/gi,
    /"amount":\s*"?\$?(\d+\.\d{2})"?/gi,
    /"orderTotal":\s*"?\$?(\d+\.\d{2})"?/gi,
    /"displayPrice":\s*"?\$?(\d+\.\d{2})"?/gi,
    /"totalAmount":\s*"?\$?(\d+\.\d{2})"?/gi
  ];
  
  // Pattern 3: Look for Amazon's JavaScript payload patterns
  const payloadPatterns = [
    /elementId[^}]*price[^}]*\$(\d+\.\d{2})/gi,
    /payload[^}]*total[^}]*\$(\d+\.\d{2})/gi,
    /orderData[^}]*amount[^}]*\$(\d+\.\d{2})/gi,
    /\$(\d+\.\d{2})[^}]*Order\s+placed/gi,
    /Order\s+placed[^}]*\$(\d+\.\d{2})/gi
  ];
  
  // Try each pattern
  for (const pattern of [...orderTotalPatterns, ...structuredPatterns, ...payloadPatterns]) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const amount = parseFloat(match[1]);
      if (amount >= 0.01 && !processedAmounts.has(amount)) {
        // Look for date context around this amount
        const contextStart = Math.max(0, match.index - 500);
        const contextEnd = Math.min(html.length, match.index + 500);
        const context = html.substring(contextStart, contextEnd);
        
        // Check if this looks like a real order (has date context)
        const hasDateContext = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i.test(context);
        
        if (hasDateContext) {
          console.log(`Found order via HTML pattern: $${amount}`);
          totalAmount += amount;
          orderCount++;
          processedAmounts.add(amount);
        }
      }
    }
  }
  
  console.log(`📊 HTML pattern results: $${totalAmount.toFixed(2)} from ${orderCount} orders`);
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
  
  // Get current page's startIndex to find the next sequential page
  const currentUrl = new URL(window.location.href);
  const currentStartIndex = parseInt(currentUrl.searchParams.get('startIndex') || '0');
  
  let bestNextLink = null;
  let smallestNextStartIndex = Infinity;
  
  for (const link of paginationLinks) {
    const text = link.textContent.trim();
    const href = link.href;
    
    console.log(`Checking link: "${text}" -> ${href}`);
    
    // Check for "Next" text first (highest priority)
    if (text.toLowerCase().includes('next') && href && !link.classList.contains('a-disabled')) {
      console.log(`Found "Next" link: ${href}`);
      return href;
    }
    
    // Look for startIndex parameter in URLs to find the next sequential page
    const startIndexMatch = href.match(/startIndex=(\d+)/);
    if (startIndexMatch) {
      const startIndex = parseInt(startIndexMatch[1]);
      
      // Find the smallest startIndex that's greater than current (next page)
      if (startIndex > currentStartIndex && startIndex < smallestNextStartIndex) {
        smallestNextStartIndex = startIndex;
        bestNextLink = href;
      }
    }
    
    // Also check page numbers as fallback
    const pageMatch = text.match(/^(\d+)$/);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1]);
      if (pageNum > highestPageNum) {
        highestPageNum = pageNum;
        highestPageUrl = href;
      }
    }
  }
  
  // Return the best next link (sequential startIndex)
  if (bestNextLink) {
    console.log(`Found next sequential page: ${bestNextLink} (startIndex: ${smallestNextStartIndex})`);
    return bestNextLink;
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

// Continue auto-scan after page navigation
async function continueAutoScan(ui, timePeriod, currentPage) {
  console.log(`📄 Scanning page ${currentPage}...`);
  ui.update(manualTotal, manualCount, `Scanning page ${currentPage}...`, timePeriod);
  
  // Get visited URLs from sessionStorage to avoid duplicates
  let visitedUrls = [];
  const progressData = sessionStorage.getItem('amazonScanProgress');
  if (progressData) {
    const progress = JSON.parse(progressData);
    visitedUrls = progress.visitedUrls || [];
  }
  
  // Add current URL to visited list
  const currentUrl = window.location.href;
  if (!visitedUrls.includes(currentUrl)) {
    visitedUrls.push(currentUrl);
  }
  
  // Scan current page and add to totals
  const pageResult = scanFirstPageOrders();
  
  // Check if this page has orders - if no orders found, we might be past the valid pages
  if (pageResult.count === 0 && currentPage > 1) {
    console.log(`⚠️ No orders found on page ${currentPage}, assuming end of valid pages`);
    sessionStorage.removeItem('amazonScanProgress');
    ui.update(manualTotal, manualCount, `Complete (${currentPage - 1} pages with orders)`, timePeriod);
    console.log(`✅ Automatic scan complete: $${manualTotal} from ${manualCount} orders across ${currentPage - 1} valid pages`);
    return;
  }
  
  // Additional check: if we're on a page beyond what Amazon shows in the dropdown
  // Look for the "X orders placed in" text to validate we're on a real page
  if (!document.body.textContent.includes('orders placed in')) {
    console.log(`⚠️ Page ${currentPage} doesn't appear to be a valid orders page`);
    sessionStorage.removeItem('amazonScanProgress');
    ui.update(manualTotal, manualCount, `Complete (${currentPage - 1} valid pages)`, timePeriod);
    console.log(`✅ Automatic scan complete: $${manualTotal} from ${manualCount} orders across ${currentPage - 1} valid pages`);
    return;
  }
  
  manualTotal += pageResult.total;
  manualCount += pageResult.count;
  
  console.log(`📄 Page ${currentPage}: $${pageResult.total} from ${pageResult.count} orders`);
  ui.update(manualTotal, manualCount, `Page ${currentPage} complete (${manualCount} total)`, timePeriod);
  
  // Look for next page
  const nextPageLink = findNextPageLink();
  
  // Additional validation: check if we've likely reached all orders
  const pageUrl = new URL(window.location.href);
  const currentStartIndex = parseInt(pageUrl.searchParams.get('startIndex') || '0');
  
  // If we have 43 orders and we're at startIndex 40, we've seen orders 41-43, so we're done
  // Generally, if startIndex + 10 >= total orders shown on page, we're at or past the end
  const pageText = document.body.textContent;
  const totalOrdersMatch = pageText.match(/(\d+)\s+orders?\s+placed\s+in/);
  if (totalOrdersMatch) {
    const totalOrders = parseInt(totalOrdersMatch[1]);
    if (currentStartIndex + 10 >= totalOrders) {
      console.log(`📊 Reached end: startIndex ${currentStartIndex} + 10 >= ${totalOrders} total orders`);
      sessionStorage.removeItem('amazonScanProgress');
      ui.update(manualTotal, manualCount, `Complete (${currentPage} pages)`, timePeriod);
      console.log(`✅ Automatic scan complete: $${manualTotal} from ${manualCount} orders across ${currentPage} pages`);
      return;
    }
  }
  
  // Stop if no next page link, reached max pages, or if we've seen this URL before
  if (!nextPageLink || currentPage >= 10 || visitedUrls.includes(nextPageLink)) {
    let reason = 'no more pages';
    if (currentPage >= 10) reason = 'max pages reached';
    if (visitedUrls.includes(nextPageLink)) reason = 'duplicate URL detected';
    
    console.log(`Scan complete: ${reason}`);
    sessionStorage.removeItem('amazonScanProgress');
    ui.update(manualTotal, manualCount, `Complete (${currentPage} pages)`, timePeriod);
    console.log(`✅ Automatic scan complete: $${manualTotal} from ${manualCount} orders across ${currentPage} pages`);
    return;
  }
  
  // Navigate to next page
  currentPage++;
  console.log(`🔄 Navigating to page ${currentPage}: ${nextPageLink}`);
  ui.update(manualTotal, manualCount, `Navigating to page ${currentPage}...`, timePeriod);
  
  // Store progress and navigate (including visited URLs)
  sessionStorage.setItem('amazonScanProgress', JSON.stringify({
    manualTotal: manualTotal,
    manualCount: manualCount,
    currentPage: currentPage,
    isAutoScanning: true,
    visitedUrls: visitedUrls
  }));
  
  // Small delay then navigate
  setTimeout(() => {
    window.location.href = nextPageLink;
  }, 1500);
}

// Scan all pages using programmatic tab navigation
async function scanAllPagesWithTabNavigation(ui, timePeriod) {
  console.log('🚀 Starting programmatic tab navigation scan...');
  
  let totalAmount = 0;
  let totalOrderCount = 0;
  let currentPage = 1;
  const maxPages = 10;
  
  // Scan the current page first
  console.log(`📄 Scanning page ${currentPage} (current page)...`);
  ui.update(totalAmount, totalOrderCount, `Scanning page ${currentPage}...`, timePeriod);
  
  const currentPageResult = scanFirstPageOrders();
  totalAmount += currentPageResult.total;
  totalOrderCount += currentPageResult.count;
  
  console.log(`📄 Page ${currentPage}: $${currentPageResult.total} from ${currentPageResult.count} orders`);
  ui.update(totalAmount, totalOrderCount, `Page ${currentPage} complete`, timePeriod);
  
  // Get total orders from page to know when to stop
  const pageText = document.body.textContent;
  const totalOrdersMatch = pageText.match(/(\d+)\s+orders?\s+placed\s+in/);
  const expectedTotalOrders = totalOrdersMatch ? parseInt(totalOrdersMatch[1]) : null;
  
  console.log(`📊 Expected total orders: ${expectedTotalOrders}`);
  
  // Store progress and start tab navigation
  const scanData = {
    totalAmount,
    totalOrderCount, 
    currentPage,
    expectedTotalOrders,
    timePeriod,
    maxPages,
    baseUrl: window.location.origin + window.location.pathname,
    timeFilter: new URL(window.location.href).searchParams.get('timeFilter') || 'months-3'
  };
  
  // Send message to background script to start tab navigation
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'START_TAB_SCAN',
      data: scanData
    });
    
    if (response && response.success) {
      console.log('Tab navigation scan initiated successfully');
      ui.update(totalAmount, totalOrderCount, 'Initiating tab navigation...', timePeriod);
      
      // Set up listener for scan updates
      chrome.runtime.onMessage.addListener(handleScanUpdate);
    } else {
      throw new Error('Failed to initiate tab navigation scan');
    }
  } catch (error) {
    console.error('Error initiating tab navigation:', error);
    ui.update(totalAmount, totalOrderCount, 'Tab navigation not supported - use manual approach', timePeriod);
  }
  
  function handleScanUpdate(message, sender, sendResponse) {
    if (message.type === 'SCAN_UPDATE') {
      const { totalAmount, totalOrderCount, status, currentPage } = message.data;
      ui.update(totalAmount, totalOrderCount, status, timePeriod);
      console.log(`📄 Tab scan update: Page ${currentPage}, $${totalAmount}, ${totalOrderCount} orders`);
    } else if (message.type === 'SCAN_COMPLETE') {
      const { totalAmount, totalOrderCount, totalPages } = message.data;
      ui.update(totalAmount, totalOrderCount, `Complete (${totalPages} pages)`, timePeriod);
      console.log(`✅ Tab navigation scan complete: $${totalAmount} from ${totalOrderCount} orders across ${totalPages} pages`);
      
      // Store final results
      manualTotal = totalAmount;
      manualCount = totalOrderCount;
      
      // Remove listener
      chrome.runtime.onMessage.removeListener(handleScanUpdate);
    }
  }
}

// Scan all pages seamlessly using background fetch (no page navigation) - DEPRECATED
async function scanAllPagesSeamlessly(ui, timePeriod) {
  console.log('🚀 Starting seamless background scan...');
  
  let totalAmount = 0;
  let totalOrderCount = 0;
  let currentPage = 1;
  const maxPages = 10;
  const visitedUrls = [];
  
  // Scan the current page first
  console.log(`📄 Scanning page ${currentPage} (current page)...`);
  ui.update(totalAmount, totalOrderCount, `Scanning page ${currentPage}...`, timePeriod);
  
  const currentPageResult = scanFirstPageOrders();
  totalAmount += currentPageResult.total;
  totalOrderCount += currentPageResult.count;
  visitedUrls.push(window.location.href);
  
  console.log(`📄 Page ${currentPage}: $${currentPageResult.total} from ${currentPageResult.count} orders`);
  ui.update(totalAmount, totalOrderCount, `Page ${currentPage} complete`, timePeriod);
  
  // Get total orders from page to know when to stop
  const pageText = document.body.textContent;
  const totalOrdersMatch = pageText.match(/(\d+)\s+orders?\s+placed\s+in/);
  const expectedTotalOrders = totalOrdersMatch ? parseInt(totalOrdersMatch[1]) : null;
  
  console.log(`📊 Expected total orders: ${expectedTotalOrders}`);
  
  // Fetch additional pages in background
  let currentStartIndex = 0;
  
  while (currentPage < maxPages) {
    // Calculate next page startIndex
    currentStartIndex += 10;
    
    // If we know total orders and we've covered them all, stop
    if (expectedTotalOrders && currentStartIndex >= expectedTotalOrders) {
      console.log(`📊 All ${expectedTotalOrders} orders covered (startIndex ${currentStartIndex}), stopping`);
      break;
    }
    
    currentPage++;
    
    // Construct next page URL
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('startIndex', currentStartIndex.toString());
    
    // Update the ref parameter to match Amazon's pagination pattern
    const fromPage = currentPage - 1;  // Previous page number
    const toPage = currentPage;        // Current page number
    currentUrl.searchParams.set('ref_', `ppx_yo2ov_dt_b_pagination_${fromPage}_${toPage}`);
    
    const nextPageUrl = currentUrl.toString();
    
    if (visitedUrls.includes(nextPageUrl)) {
      console.log('🔄 Duplicate URL detected, stopping');
      break;
    }
    
    console.log(`📄 Fetching page ${currentPage} in background: ${nextPageUrl}`);
    ui.update(totalAmount, totalOrderCount, `Fetching page ${currentPage}...`, timePeriod);
    
    try {
      // Fetch the page with enhanced headers to mimic a real browser request
      const response = await fetch(nextPageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': navigator.userAgent,
          'Referer': window.location.href
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch page ${currentPage}: ${response.status}`);
        break;
      }
      
      const html = await response.text();
      visitedUrls.push(nextPageUrl);
      
      // Debug: Log what we actually received
      console.log(`📄 Page ${currentPage} HTML length: ${html.length}`);
      console.log(`📄 Page ${currentPage} contains "Sign in": ${html.includes('Sign in')}`);
      console.log(`📄 Page ${currentPage} contains "orders placed in": ${html.includes('orders placed in')}`);
      console.log(`📄 Page ${currentPage} contains "Order placed": ${html.includes('Order placed')}`);
      console.log(`📄 Page ${currentPage} first 500 chars:`, html.substring(0, 500));
      
      // Check if we got redirected to sign-in (more specific check)
      if (html.includes('Sign in') && html.includes('email or mobile phone') && html.includes('Continue')) {
        console.warn(`Page ${currentPage} redirected to sign-in - authentication issue`);
        ui.update(totalAmount, totalOrderCount, `Auth issue on page ${currentPage} - partial results`, timePeriod);
        break;
      }
      
      // More flexible check for order content - look for various order indicators
      const hasOrderContent = html.includes('orders placed in') || 
                             html.includes('Order placed') || 
                             html.includes('Your Orders') ||
                             html.includes('a-box-group') ||
                             html.includes('Order #') ||
                             html.includes('Total') ||
                             /\$\d+\.\d{2}/.test(html);
      
      if (!hasOrderContent) {
        console.log(`Page ${currentPage} doesn't contain recognizable order content, stopping`);
        console.log(`📄 Debugging: Page title in HTML: ${html.match(/<title>(.*?)<\/title>/)?.[1] || 'No title found'}`);
        break;
      } else {
        console.log(`📄 Page ${currentPage} has order content, proceeding with scan`);
      }
      
             // Parse the fetched page
       const parser = new DOMParser();
       const doc = parser.parseFromString(html, 'text/html');
       
       // Debug: Check what elements we can find in the parsed document
       const boxGroups = doc.querySelectorAll('.a-box-group');
       const orderElements = doc.querySelectorAll('[class*="order"]');
       const dollarAmounts = html.match(/\$\d+\.\d{2}/g);
       
       console.log(`📄 Page ${currentPage} parsed elements:`);
       console.log(`  - .a-box-group elements: ${boxGroups.length}`);
       console.log(`  - [class*="order"] elements: ${orderElements.length}`);
       console.log(`  - Dollar amounts found: ${dollarAmounts ? dollarAmounts.length : 0}`);
       if (dollarAmounts) console.log(`  - Sample amounts: ${dollarAmounts.slice(0, 5).join(', ')}`);
       
              // Scan the fetched page
       const pageResult = scanPageFromDocument(doc);
       
       // If no orders found with DOM parsing, try direct HTML pattern matching
       if (pageResult.count === 0) {
         console.log(`No orders found with DOM parsing, trying direct HTML pattern matching...`);
         const htmlOrderResult = scanOrdersFromHTML(html);
         
         if (htmlOrderResult.count > 0) {
           console.log(`Found ${htmlOrderResult.count} orders via HTML pattern matching`);
           totalAmount += htmlOrderResult.total;
           totalOrderCount += htmlOrderResult.count;
           
           console.log(`📄 Page ${currentPage}: $${htmlOrderResult.total} from ${htmlOrderResult.count} orders (HTML parsing)`);
           ui.update(totalAmount, totalOrderCount, `Page ${currentPage} complete`, timePeriod);
         } else {
           console.log(`No orders found on page ${currentPage}, assuming end of valid pages`);
           break;
         }
       }
      
      totalAmount += pageResult.total;
      totalOrderCount += pageResult.count;
      
      console.log(`📄 Page ${currentPage}: $${pageResult.total} from ${pageResult.count} orders`);
      ui.update(totalAmount, totalOrderCount, `Page ${currentPage} complete`, timePeriod);
      
      // Small delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      ui.update(totalAmount, totalOrderCount, `Error on page ${currentPage} - partial results`, timePeriod);
      break;
    }
  }
  
  console.log(`✅ Seamless scan complete: $${totalAmount.toFixed(2)} from ${totalOrderCount} orders across ${currentPage} pages`);
  ui.update(totalAmount, totalOrderCount, `Complete (${currentPage} pages)`, timePeriod);
  
  // Store final results in manual mode variables
  manualTotal = totalAmount;
  manualCount = totalOrderCount;
}

// Scan all pages using automatic navigation (browser page changes) - DEPRECATED
async function scanAllPagesWithNavigation(ui, timePeriod) {
  console.log('🚀 Starting automatic navigation scan...');
  
  // Start with page 1
  await continueAutoScan(ui, timePeriod, 1);
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
      
      // Debug: Check if we got actual order content
      console.log(`Fetched page ${currentPage} HTML length:`, html.length);
      console.log(`Contains "Order placed":`, html.includes('Order placed'));
      console.log(`Contains "Total":`, html.includes('Total'));
      console.log(`Contains "Jul":`, html.includes('Jul'));
      
      // Check if we got redirected to sign-in
      if (html.includes('Sign in') && html.includes('email or mobile phone')) {
        console.error(`Page ${currentPage} redirected to sign-in - authentication issue`);
        break;
      }
      
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
  
  // Debug: Show what we're processing
  if (orderElements.length > 0) {
    console.log(`Sample element from fetched page:`, orderElements[0].textContent.substring(0, 300));
  }
  
  orderElements.forEach((element, index) => {
    const text = element.textContent;
    const html = element.innerHTML;
    
    // Skip JavaScript elements
    if (text.includes('window.uet') || text.includes('performance.mark') || 
        text.includes('function(') || text.includes('try {') || 
        text.includes('var ') || text.includes('const ') || text.includes('let ') ||
        text.length < 50) {
      console.log(`Skipped JavaScript/short element in fetched page: ${text.substring(0, 100)}`);
      return;
    }
    
    // Look for dollar amounts in both text content and HTML
    let moneyMatches = text.match(/\$(\d+(?:\.\d{2})?)/g);
    if (!moneyMatches) {
      // Also search in HTML for encoded dollar amounts
      moneyMatches = html.match(/\$(\d+(?:\.\d{2})?)/g) || html.match(/&#36;(\d+(?:\.\d{2})?)/g);
    }
    
    if (moneyMatches && moneyMatches.length > 0) {
      const amounts = moneyMatches.map(match => parseFloat(match.replace(/[\$&#36;]/g, '')));
      const maxAmount = Math.max(...amounts);
      
      if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
        // More flexible order detection for fetched content
        const hasOrderText = text.includes('Order placed') || text.includes('Total') || text.includes('Order #') ||
                            html.includes('Order placed') || html.includes('Total') || html.includes('Order #');
        const hasMonth = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(text) ||
                        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(html);
        
        if (hasOrderText && hasMonth) {
          console.log(`Found order amount: $${maxAmount} in fetched element:`, text.substring(0, 150));
          totalAmount += maxAmount;
          orderCount++;
          processedAmounts.add(maxAmount);
        } else {
          console.log(`Skipped potential order (validation failed): $${maxAmount} - hasOrderText: ${hasOrderText}, hasMonth: ${hasMonth}`);
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
        💡 "This Page" scans current page and adds to total<br>
        "All Pages" opens tabs to scan each page automatically<br>
        <span style="color: #007185;">🚀 "All Pages" uses real browser tabs for accuracy!</span>
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

// Global variables for manual page accumulation
let manualTotal = 0;
let manualCount = 0;
let isManualMode = false;

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

  // Check if we're in the middle of an auto-scan
  const scanProgress = sessionStorage.getItem('amazonScanProgress');
  if (scanProgress) {
    const progress = JSON.parse(scanProgress);
    if (progress.isAutoScanning) {
      console.log('🔄 Resuming automatic scan...', progress);
      manualTotal = progress.manualTotal || 0;
      manualCount = progress.manualCount || 0;
      isManualMode = true;
      
      // Continue the scan on this new page
      setTimeout(() => {
        continueAutoScan(ui, timePeriod, progress.currentPage);
      }, 1000); // Give page time to load
      
      ui.update(manualTotal, manualCount, `Resuming scan on page ${progress.currentPage}...`, timePeriod);
      return; // Don't set up normal UI yet
    }
  }

  // Initialize with ready state
  ui.update(0, 0, "Ready", timePeriod);

  function runScanPage() {
    console.log('🚀 Starting page calculation...');
    ui.update(manualTotal, manualCount, "Calculating this page...", timePeriod);
    
    try {
      const result = scanFirstPageOrders();
      
      if (isManualMode) {
        // Add to running total
        manualTotal += result.total;
        manualCount += result.count;
        ui.update(manualTotal, manualCount, `Added page (${manualCount} total orders)`, timePeriod);
        console.log(`✅ Page added: +$${result.total} (+${result.count} orders) = Total: $${manualTotal} (${manualCount} orders)`);
      } else {
        // First page or reset - start manual mode
        manualTotal = result.total;
        manualCount = result.count;
        isManualMode = true;
        ui.update(manualTotal, manualCount, "Page complete - Navigate to next page manually", timePeriod);
        console.log(`✅ Page calculation complete: $${result.total} from ${result.count} orders. Navigate manually for more pages.`);
      }
    } catch (e) {
      console.error('Calculation error:', e);
      ui.update(manualTotal, manualCount, `Error: ${String(e)}`, timePeriod);
    }
  }

  async function runScanAll() {
    console.log('🚀 Starting comprehensive calculation with programmatic navigation...');
    ui.update(0, 0, "Starting programmatic scan...", timePeriod);
    
    try {
      // Clear any existing scan progress and reset
      sessionStorage.removeItem('amazonScanProgress');
      manualTotal = 0;
      manualCount = 0;
      isManualMode = true;
      
      // Start the programmatic tab navigation process
      await scanAllPagesWithTabNavigation(ui, timePeriod);
      
    } catch (e) {
      console.error('Comprehensive scan error:', e);
      ui.update(manualTotal, manualCount, `Error: ${String(e)}`, timePeriod);
    }
  }

  function clearResults() {
    manualTotal = 0;
    manualCount = 0;
    isManualMode = false;
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