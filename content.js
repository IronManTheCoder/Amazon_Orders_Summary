/**
 * Amazon Orders Extension - Content Script
 * Modular architecture using OrderScanner, ChartRenderer, and UIManager
 */

class AmazonOrdersExtension {
  constructor() {
    this.orderScanner = new OrderScanner();
    this.chartRenderer = new ChartRenderer('monthly-chart');
    this.uiManager = new UIManager();
    
    this.storedMonthlyData = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the extension
   */
  async init() {
    if (this.isInitialized) {
      console.log('Extension already initialized');
      return;
    }

    console.log('🚀 Initializing Amazon Orders Extension...');
    
    // Check if panel already exists
    if (this.uiManager.exists()) {
      console.log('Panel already exists, skipping initialization');
      return;
    }

    // Create UI panel
    if (!this.uiManager.createPanel()) {
      console.error('Failed to create UI panel');
      return;
    }

    // Setup event handlers
    this.setupEventHandlers();
    
    // Setup background script communication
    this.setupBackgroundCommunication();

    // Initialize with ready state
    this.uiManager.update(0, 0, "Ready", "All Orders", {});

    this.isInitialized = true;
    console.log('✅ Extension initialized successfully');
  }

  /**
   * Setup UI event handlers
   */
  setupEventHandlers() {
    // Register scan handlers
    this.uiManager.onScanAll(() => this.runAllPagesScan());
    this.uiManager.onClear(() => this.clearResults());

    // Register chart toggle handler
    this.uiManager.on('onChartToggle', (isVisible) => {
      if (isVisible && this.storedMonthlyData) {
        this.chartRenderer.drawChart(this.storedMonthlyData);
      }
    });
  }

  /**
   * Setup background script communication
   */
  setupBackgroundCommunication() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'SCAN_UPDATE') {
          this.handleScanUpdate(msg.data);
        } else if (msg.type === 'SCAN_COMPLETE') {
          this.handleScanComplete(msg.data);
        }
      });
    }
  }

  /**
   * Handle scan update from background script
   * @param {Object} data - Scan update data
   */
  handleScanUpdate(data) {
    const currentTimePeriod = this.getSelectedTimePeriod();
    
    // Update stored monthly data with the latest from background script
    if (data.monthlyData) {
      this.storedMonthlyData = data.monthlyData;
    }
    
    this.uiManager.update(
      data.totalAmount, 
      data.totalOrderCount, 
      data.status, 
      currentTimePeriod, 
      this.storedMonthlyData
    );

    // Update chart if visible
    if (this.uiManager.isChartVisible()) {
      this.chartRenderer.drawChart(this.storedMonthlyData);
    }
  }

  /**
   * Handle scan completion from background script
   * @param {Object} data - Scan completion data
   */
  handleScanComplete(data) {
    const currentTimePeriod = this.getSelectedTimePeriod();
    
    // Update stored monthly data with the final result
    if (data.monthlyData) {
      this.storedMonthlyData = data.monthlyData;
    }
    
    this.uiManager.update(
      data.totalAmount, 
      data.totalOrderCount, 
      "Scan complete!", 
      currentTimePeriod, 
      this.storedMonthlyData
    );

    // Update chart if visible
    if (this.uiManager.isChartVisible()) {
      this.chartRenderer.drawChart(this.storedMonthlyData);
    }

    console.log(`✅ All pages scan complete: $${data.totalAmount} from ${data.totalOrderCount} orders across ${data.totalPages} pages`);
    console.log(`📅 Complete monthly breakdown:`, this.storedMonthlyData);
  }



  /**
   * Run all pages scan using background script
   */
  runAllPagesScan() {
    console.log('🚀 Starting all pages scan...');
    this.uiManager.update(0, 0, "Starting multi-page scan...", null, {});
    
    // Get current page data
    const currentResult = this.orderScanner.scanCurrentPage();
    const timePeriod = this.getSelectedTimePeriod();
    const baseUrl = window.location.origin + window.location.pathname;
    const timeFilter = new URLSearchParams(window.location.search).get('timeFilter') || 'all';
    
    // Initialize monthly data with first page data
    this.storedMonthlyData = currentResult.monthlyData || {};
    
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
      this.uiManager.update(0, 0, "Error: Extension not available", null, {});
    }
  }

  /**
   * Clear results and reset UI
   */
  clearResults() {
    this.storedMonthlyData = {};
    this.chartRenderer.clearChart();
    this.uiManager.update(0, 0, "Ready to calculate", "All Orders", {});
    console.log('🧹 Results cleared');
  }

  /**
   * Get selected time period from page
   * @returns {string} Time period
   */
  getSelectedTimePeriod() {
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

  /**
   * Ensure panel exists (for navigation events)
   */
  ensurePanelExists() {
    if (!this.uiManager.exists()) {
      console.log('Panel missing, recreating...');
      this.init();
    }
  }

  /**
   * Setup navigation event listeners
   */
  setupNavigationListeners() {
    // Listen for navigation events
    window.addEventListener('popstate', () => {
      console.log('Navigation detected (popstate)');
      setTimeout(() => this.ensurePanelExists(), 1000);
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      console.log('Hash change detected');
      setTimeout(() => this.ensurePanelExists(), 1000);
    });

    // Observe DOM changes for SPA navigation
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
        setTimeout(() => this.ensurePanelExists(), 500);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Periodic check to ensure panel exists (fallback)
    setInterval(() => this.ensurePanelExists(), 5000);
  }
}

// Create and initialize extension instance
const amazonOrdersExtension = new AmazonOrdersExtension();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    amazonOrdersExtension.init();
    amazonOrdersExtension.setupNavigationListeners();
  });
} else {
  amazonOrdersExtension.init();
  amazonOrdersExtension.setupNavigationListeners();
}

// Export for debugging
window.amazonOrdersExtension = amazonOrdersExtension;