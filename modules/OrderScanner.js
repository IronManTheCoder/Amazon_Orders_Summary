/**
 * OrderScanner Module
 * Handles Amazon order detection and parsing
 */
class OrderScanner {
  constructor() {
    this.orderSelectors = [
      'li.order-card__list',
      '.order-card',
      '.a-box-group',
      '[class*="order"]',
      '[class*="shipment"]',
      '.a-card',
      '[data-testid*="order"]',
      '[class*="order-item"]'
    ];
    
    this.debugInfo = {
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
  }

  /**
   * Scan current page for orders
   * @returns {Object} { total, count, monthlyData }
   */
  scanCurrentPage() {
    console.log('🔍 Scanning current page for orders...');
    
    let totalAmount = 0;
    let orderCount = 0;
    const processedAmounts = new Set();
    const monthlyData = {};
    
    // Reset debug info
    this.resetDebugInfo();
    
    const orderElements = this.findOrderElements();
    this.debugInfo.totalElements = orderElements.length;
    
    orderElements.forEach((element, index) => {
      const result = this.processOrderElement(element, processedAmounts, monthlyData);
      if (result) {
        totalAmount += result.amount;
        orderCount++;
      }
    });
    
    this.logDebugInfo(totalAmount, orderCount);
    
    return {
      total: totalAmount,
      count: orderCount,
      monthlyData: monthlyData
    };
  }

  /**
   * Find order elements on the page
   * @returns {NodeList|Array} Order elements
   */
  findOrderElements() {
    let orderElements = [];
    
    // Try specific selectors first
    for (const selector of this.orderSelectors) {
      orderElements = document.querySelectorAll(selector);
      if (orderElements.length > 0) {
        console.log(`Found ${orderElements.length} elements with selector: ${selector}`);
        return orderElements;
      }
    }
    
    // Fallback: search by content
    if (orderElements.length === 0) {
      const allElements = document.querySelectorAll('*');
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
    
    return orderElements;
  }

  /**
   * Process a single order element
   * @param {Element} element - Order element to process
   * @param {Set} processedAmounts - Set of already processed amounts
   * @param {Object} monthlyData - Monthly data object to update
   * @returns {Object|null} { amount } or null if not valid
   */
  processOrderElement(element, processedAmounts, monthlyData) {
    const text = element.textContent;
    
    // Try to find total element using multiple patterns
    const totalElement = this.findTotalElement(element);
    
    if (totalElement) {
      return this.processSpecificTotal(totalElement, text, processedAmounts, monthlyData);
    } else {
      return this.processFallbackTotal(text, processedAmounts, monthlyData);
    }
  }

  /**
   * Find total element within order element
   * @param {Element} element - Order element
   * @returns {Element|null} Total element or null
   */
  findTotalElement(element) {
    const patterns = [
      '.a-column.a-span2 .order-header__header-list-item .a-row:last-child .a-size-base',
      '.a-column.a-span2 .order-header__header-list-item .a-row .a-size-base'
    ];
    
    for (const pattern of patterns) {
      const totalElement = element.querySelector(pattern);
      if (totalElement) return totalElement;
    }
    
    // Look for "Total" label pattern
    const totalLabel = element.querySelector('.a-column.a-span2 .order-header__header-list-item .a-row .a-text-caps');
    if (totalLabel && totalLabel.textContent.trim().toLowerCase().includes('total')) {
      const nextRow = totalLabel.closest('.a-row').nextElementSibling;
      if (nextRow) {
        return nextRow.querySelector('.a-size-base');
      }
    }
    
    // Look for any .a-size-base with dollar amount
    const sizeBaseElements = element.querySelectorAll('.a-size-base');
    for (const el of sizeBaseElements) {
      if (el.textContent.match(/\$(\d+\.\d{2})/)) {
        return el;
      }
    }
    
    return null;
  }

  /**
   * Process specific total element
   * @param {Element} totalElement - Total element
   * @param {string} text - Full text content
   * @param {Set} processedAmounts - Processed amounts set
   * @param {Object} monthlyData - Monthly data object
   * @returns {Object|null} Result or null
   */
  processSpecificTotal(totalElement, text, processedAmounts, monthlyData) {
    const totalText = totalElement.textContent.trim();
    const totalMatch = totalText.match(/\$(\d+\.\d{2})/);
    
    if (totalMatch) {
      const orderTotal = parseFloat(totalMatch[1]);
      this.debugInfo.elementsWithMoney++;
      
      if (orderTotal >= 0.01 && !processedAmounts.has(orderTotal)) {
        const validation = this.validateOrder(text);
        
        if (validation.isValid) {
          this.updateMonthlyData(validation.monthMatch, orderTotal, monthlyData);
          processedAmounts.add(orderTotal);
          this.debugInfo.elementsPassedAllChecks++;
          console.log(`✅ Found order total: $${orderTotal}`);
          return { amount: orderTotal };
        } else {
          this.logSkipReason(validation, orderTotal);
        }
      } else {
        if (orderTotal < 0.01) this.debugInfo.skippedReasons.tooSmall++;
        if (processedAmounts.has(orderTotal)) this.debugInfo.skippedReasons.duplicateAmount++;
      }
    } else {
      this.debugInfo.skippedReasons.noMoney++;
    }
    
    return null;
  }

  /**
   * Process fallback total (when specific element not found)
   * @param {string} text - Text content
   * @param {Set} processedAmounts - Processed amounts set
   * @param {Object} monthlyData - Monthly data object
   * @returns {Object|null} Result or null
   */
  processFallbackTotal(text, processedAmounts, monthlyData) {
    const moneyMatches = text.match(/\$(\d+\.\d{2})/g);
    
    if (moneyMatches && moneyMatches.length > 0) {
      this.debugInfo.elementsWithMoney++;
      
      const amounts = moneyMatches.map(match => parseFloat(match.replace('$', '')));
      const maxAmount = Math.max(...amounts);
      
      if (maxAmount >= 0.01 && !processedAmounts.has(maxAmount)) {
        const validation = this.validateOrder(text);
        
        if (validation.isValid) {
          this.updateMonthlyData(validation.monthMatch, maxAmount, monthlyData);
          processedAmounts.add(maxAmount);
          this.debugInfo.elementsPassedAllChecks++;
          console.log(`✅ Found order amount (fallback): $${maxAmount}`);
          return { amount: maxAmount };
        } else {
          this.logSkipReason(validation, maxAmount);
        }
      } else {
        if (maxAmount < 0.01) this.debugInfo.skippedReasons.tooSmall++;
        if (processedAmounts.has(maxAmount)) this.debugInfo.skippedReasons.duplicateAmount++;
      }
    } else {
      this.debugInfo.skippedReasons.noMoney++;
    }
    
    return null;
  }

  /**
   * Validate if text represents a real order
   * @param {string} text - Text to validate
   * @returns {Object} Validation result
   */
  validateOrder(text) {
    const hasOrderText = text.includes('Order placed') || text.includes('Order #') || text.includes('Ordered');
    const monthMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    const hasMonth = monthMatch !== null;
    
    if (hasOrderText) this.debugInfo.elementsWithOrderText++;
    if (hasMonth) this.debugInfo.elementsWithMonth++;
    
    return {
      isValid: hasOrderText && hasMonth,
      hasOrderText,
      hasMonth,
      monthMatch
    };
  }

  /**
   * Update monthly data with order information
   * @param {Array|null} monthMatch - Regex match result for month
   * @param {number} amount - Order amount
   * @param {Object} monthlyData - Monthly data object to update
   */
  updateMonthlyData(monthMatch, amount, monthlyData) {
    if (monthMatch) {
      const monthName = monthMatch[1];
      const year = monthMatch[3];
      const monthKey = `${monthName} ${year}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, count: 0 };
      }
      monthlyData[monthKey].total += amount;
      monthlyData[monthKey].count += 1;
      
      console.log(`📅 Added $${amount} to ${monthKey}`);
    }
  }

  /**
   * Log skip reason for debugging
   * @param {Object} validation - Validation result
   * @param {number} amount - Order amount
   */
  logSkipReason(validation, amount) {
    if (!validation.hasOrderText) {
      this.debugInfo.skippedReasons.noOrderText++;
      console.log(`❌ Skipped $${amount} - No order text`);
    }
    if (!validation.hasMonth) {
      this.debugInfo.skippedReasons.noMonth++;
      console.log(`❌ Skipped $${amount} - No month`);
    }
  }

  /**
   * Reset debug information
   */
  resetDebugInfo() {
    this.debugInfo = {
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
  }

  /**
   * Log debug information
   * @param {number} totalAmount - Total amount found
   * @param {number} orderCount - Number of orders found
   */
  logDebugInfo(totalAmount, orderCount) {
    console.log('📊 DEBUG INFO:');
    console.log(`  Total elements scanned: ${this.debugInfo.totalElements}`);
    console.log(`  Elements with money: ${this.debugInfo.elementsWithMoney}`);
    console.log(`  Elements with order text: ${this.debugInfo.elementsWithOrderText}`);
    console.log(`  Elements with month: ${this.debugInfo.elementsWithMonth}`);
    console.log(`  Elements passed all checks: ${this.debugInfo.elementsPassedAllChecks}`);
    console.log('📊 SKIPPED REASONS:');
    Object.entries(this.debugInfo.skippedReasons).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
    console.log(`📊 Results: $${totalAmount.toFixed(2)} from ${orderCount} orders`);
  }
}

// Export for use in other modules
window.OrderScanner = OrderScanner; 