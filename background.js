/**
 * Amazon Orders Extension - Background Script
 * Modular architecture using BackgroundScanner
 */

// Import the BackgroundScanner module using ES6 syntax
import { BackgroundScanner } from './modules/BackgroundScanner.js';

/**
 * Amazon Orders Background Service
 * Handles multi-page scanning and tab management
 */
class AmazonOrdersBackground {
  constructor() {
    this.scanner = new BackgroundScanner();
    this.setupEventListeners();
  }

  /**
   * Setup chrome extension event listeners
   */
  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log("Amazon Orders Extension installed");
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      this.handleMessage(msg, sender, sendResponse);
    });
  }

  /**
   * Handle incoming messages
   * @param {Object} msg - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   */
  handleMessage(msg, sender, sendResponse) {
    try {
      if (msg?.type === "PING") {
        sendResponse({ ok: true, ts: Date.now() });
        return;
      }
      
      if (msg?.type === "START_TAB_SCAN") {
        this.handleStartTabScan(msg, sender, sendResponse);
        return;
      }
    } catch (error) {
      console.error('Error in message handler:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle start tab scan message
   * @param {Object} msg - Message object
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   */
  handleStartTabScan(msg, sender, sendResponse) {
    console.log('Starting tab navigation scan:', msg.data);
    
    this.scanner.startTabNavigationScan(msg.data, sender.tab.id)
      .catch(error => {
        console.error('Error in tab navigation scan:', error);
        this.sendErrorToTab(sender.tab.id, error, msg.data);
      });
    
    sendResponse({ success: true });
  }

  /**
   * Send error message to tab
   * @param {number} tabId - Tab ID
   * @param {Error} error - Error object
   * @param {Object} originalData - Original scan data
   */
  async sendErrorToTab(tabId, error, originalData) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SCAN_UPDATE',
        data: {
          totalAmount: originalData.totalAmount || 0,
          totalOrderCount: originalData.totalOrderCount || 0,
          monthlyData: originalData.monthlyData || {},
          status: `Error: ${error.message}`,
          currentPage: 1
        }
      });
    } catch (sendError) {
      console.log('Could not send error message to tab (may be closed)');
    }
  }

  /**
   * Get extension statistics
   * @returns {Object} Extension stats
   */
  getStats() {
    return {
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Initialize the background service
   */
  init() {
    this.startTime = Date.now();
    console.log('🚀 Amazon Orders Background Service initialized');
  }
}

// Create and initialize the background service
const amazonOrdersBackground = new AmazonOrdersBackground();
amazonOrdersBackground.init();

// Export for debugging
self.amazonOrdersBackground = amazonOrdersBackground;