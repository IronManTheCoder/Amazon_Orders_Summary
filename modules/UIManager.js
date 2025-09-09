/**
 * UIManager Module
 * Handles popup UI creation, management, and interactions
 */
class UIManager {
  constructor() {
    this.panelId = 'amazon-spend-dashboard';
    this.panel = null;
    this.elements = {};
    this.eventHandlers = {};
    this.chartVisible = false;
    this.dragState = {
      isDragging: false,
      currentX: 0,
      currentY: 0,
      initialX: 0,
      initialY: 0,
      xOffset: 0,
      yOffset: 0
    };
    this.positionIndex = 0;
    this.positions = [
      { top: '50%', left: '20px', right: 'auto', bottom: 'auto', transform: 'translateY(-50%)' },
      { top: '50%', right: '20px', left: 'auto', bottom: 'auto', transform: 'translateY(-50%)' },
      { bottom: '20px', left: '20px', top: 'auto', right: 'auto', transform: 'none' },
      { bottom: '20px', right: '20px', top: 'auto', left: 'auto', transform: 'none' }
    ];
  }

  /**
   * Create and inject the UI panel
   * @returns {boolean} Success status
   */
  createPanel() {
    // Remove existing panel if it exists
    this.removePanel();
    
    // Create the panel
    this.panel = document.createElement('div');
    this.panel.id = this.panelId;
    this.panel.innerHTML = this.getPanelHTML();
    
    // Add to page
    document.body.appendChild(this.panel);
    
    // Get element references
    this.getElementReferences();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    return true;
  }

  /**
   * Get the HTML structure for the panel
   * @returns {string} Panel HTML
   */
  getPanelHTML() {
    return `
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
        ${this.getHeaderHTML()}
        ${this.getSummaryHTML()}
        ${this.getChartHTML()}
        ${this.getButtonsHTML()}
        ${this.getFooterHTML()}
      </div>
    `;
  }

  /**
   * Get header HTML
   * @returns {string} Header HTML
   */
  getHeaderHTML() {
    return `
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
    `;
  }

  /**
   * Get summary section HTML
   * @returns {string} Summary HTML
   */
  getSummaryHTML() {
    return `
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
    `;
  }

  /**
   * Get chart section HTML
   * @returns {string} Chart HTML
   */
  getChartHTML() {
    return `
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
    `;
  }

  /**
   * Get action buttons HTML
   * @returns {string} Buttons HTML
   */
  getButtonsHTML() {
    return `
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button id="scan-all-button" style="
          flex: 1;
          background: #007185;
          color: white;
          border: none;
          padding: 12px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background-color 0.2s;
        ">📊 Calculate All Orders</button>
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
    `;
  }

  /**
   * Get footer HTML
   * @returns {string} Footer HTML
   */
  getFooterHTML() {
    return `
      <div style="font-size: 11px; color: #666; line-height: 1.4; text-align: center;">
        💡 Analyzes orders on the current page<br/>
        📊 Both options now support monthly charts
      </div>
    `;
  }

  /**
   * Get references to DOM elements
   */
  getElementReferences() {
    const elementIds = [
      'total-amount', 'order-count', 'status-text', 'period-text',
      'scan-page-button', 'scan-all-button', 'clear-button', 'close-panel',
      'position-btn', 'dashboard-panel', 'chart-section', 'toggle-view', 'monthly-chart'
    ];

    elementIds.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });

    // Verify critical elements exist
    if (!this.elements['dashboard-panel']) {
      console.error('Dashboard panel element not found');
      return false;
    }

    return true;
  }

  /**
   * Setup all event handlers
   */
  setupEventHandlers() {
    this.setupDragHandlers();
    this.setupButtonHandlers();
    this.setupChartHandlers();
  }

  /**
   * Setup drag and drop functionality
   */
  setupDragHandlers() {
    const panel = this.elements['dashboard-panel'];
    if (!panel) return;

    panel.addEventListener('mousedown', (e) => this.dragStart(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', (e) => this.dragEnd(e));
  }

  /**
   * Setup button event handlers
   */
  setupButtonHandlers() {
    // Close button
    if (this.elements['close-panel']) {
      this.elements['close-panel'].addEventListener('click', () => {
        this.removePanel();
      });
    }

    // Position button
    if (this.elements['position-btn']) {
      this.elements['position-btn'].addEventListener('click', () => {
        this.cyclePosition();
      });
    }

    // Hover effects
    this.setupHoverEffects();
  }

  /**
   * Setup chart-related handlers
   */
  setupChartHandlers() {
    if (this.elements['toggle-view']) {
      this.elements['toggle-view'].addEventListener('click', () => {
        this.toggleChartView();
      });
    }
  }

  /**
   * Setup hover effects for buttons
   */
  setupHoverEffects() {
    const buttonHovers = {
      'scan-all-button': { normal: '#007185', hover: '#005f73' },
      'clear-button': { normal: '#6c757d', hover: '#5a6268' }
    };

    Object.entries(buttonHovers).forEach(([id, colors]) => {
      const button = this.elements[id];
      if (button) {
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = colors.hover;
        });
        button.addEventListener('mouseleave', () => {
          button.style.backgroundColor = colors.normal;
        });
      }
    });
  }

  /**
   * Update UI with new data
   * @param {number} total - Total amount
   * @param {number} count - Order count
   * @param {string} status - Status message
   * @param {string} period - Time period
   * @param {Object} monthlyData - Monthly data for chart
   */
  update(total, count, status, period, monthlyData) {
    if (this.elements['total-amount']) {
      this.elements['total-amount'].textContent = total.toFixed(2);
    }
    if (this.elements['order-count']) {
      this.elements['order-count'].textContent = count;
    }
    if (status && this.elements['status-text']) {
      this.elements['status-text'].textContent = status;
    }
    if (period && this.elements['period-text']) {
      this.elements['period-text'].textContent = period;
    }

    if (monthlyData) {
      this.updateChartSection(monthlyData);
    }

    console.log(`UI Update: $${total} (${count} orders) - ${status} - ${period || 'N/A'}`);
  }

  /**
   * Update chart section visibility and data
   * @param {Object} monthlyData - Monthly data
   */
  updateChartSection(monthlyData) {
    const hasData = monthlyData && Object.keys(monthlyData).length > 0;
    
    if (this.elements['chart-section']) {
      this.elements['chart-section'].style.display = hasData ? 'block' : 'none';
    }

    if (hasData) {
      console.log(`📊 Showing chart section with ${Object.keys(monthlyData).length} months of data`);
    }
  }

  /**
   * Toggle chart view
   */
  toggleChartView() {
    this.chartVisible = !this.chartVisible;
    
    if (this.elements['monthly-chart']) {
      this.elements['monthly-chart'].style.display = this.chartVisible ? 'block' : 'none';
    }
    
    if (this.elements['toggle-view']) {
      this.elements['toggle-view'].textContent = this.chartVisible ? '📈 Summary View' : '📊 Chart View';
    }

    // Emit chart toggle event
    if (this.eventHandlers.onChartToggle) {
      this.eventHandlers.onChartToggle(this.chartVisible);
    }
  }

  /**
   * Cycle through position presets
   */
  cyclePosition() {
    this.positionIndex = (this.positionIndex + 1) % this.positions.length;
    const pos = this.positions[this.positionIndex];
    const panel = this.elements['dashboard-panel'];
    
    if (panel) {
      panel.style.top = pos.top;
      panel.style.right = pos.right;
      panel.style.left = pos.left;
      panel.style.bottom = pos.bottom;
      panel.style.transform = pos.transform === 'none' ? 'translate(0, 0)' : pos.transform;
      
      // Reset drag offsets
      this.dragState.xOffset = 0;
      this.dragState.yOffset = 0;
    }
  }

  /**
   * Handle drag start
   * @param {Event} e - Mouse event
   */
  dragStart(e) {
    if (this.shouldIgnoreDrag(e.target)) return;

    this.dragState.initialX = e.clientX - this.dragState.xOffset;
    this.dragState.initialY = e.clientY - this.dragState.yOffset;

    const panel = this.elements['dashboard-panel'];
    if (e.target === panel || panel.contains(e.target)) {
      this.dragState.isDragging = true;
    }
  }

  /**
   * Handle drag movement
   * @param {Event} e - Mouse event
   */
  drag(e) {
    if (this.dragState.isDragging) {
      e.preventDefault();
      this.dragState.currentX = e.clientX - this.dragState.initialX;
      this.dragState.currentY = e.clientY - this.dragState.initialY;

      this.dragState.xOffset = this.dragState.currentX;
      this.dragState.yOffset = this.dragState.currentY;

      const panel = this.elements['dashboard-panel'];
      if (panel) {
        panel.style.transform = `translate(${this.dragState.currentX}px, ${this.dragState.currentY}px)`;
      }
    }
  }

  /**
   * Handle drag end
   * @param {Event} e - Mouse event
   */
  dragEnd(e) {
    this.dragState.initialX = this.dragState.currentX;
    this.dragState.initialY = this.dragState.currentY;
    this.dragState.isDragging = false;
  }

  /**
   * Check if drag should be ignored for this target
   * @param {Element} target - Target element
   * @returns {boolean} Whether to ignore drag
   */
  shouldIgnoreDrag(target) {
    const ignoredIds = ['close-panel', 'position-btn', 'scan-page-button', 'scan-all-button', 'clear-button', 'toggle-view'];
    return ignoredIds.includes(target.id);
  }

  /**
   * Remove the panel from DOM
   */
  removePanel() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.elements = {};
    }
  }

  /**
   * Check if panel exists
   * @returns {boolean} Panel existence status
   */
  exists() {
    return document.getElementById(this.panelId) !== null;
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    this.eventHandlers[event] = handler;
  }

  /**
   * Register scan all pages handler
   * @param {Function} callback - Callback function
   */
  onScanAll(callback) {
    if (this.elements['scan-all-button']) {
      this.elements['scan-all-button'].addEventListener('click', callback);
    }
  }

  /**
   * Register clear handler
   * @param {Function} callback - Callback function
   */
  onClear(callback) {
    if (this.elements['clear-button']) {
      this.elements['clear-button'].addEventListener('click', callback);
    }
  }

  /**
   * Get current chart visibility state
   * @returns {boolean} Chart visibility
   */
  isChartVisible() {
    return this.chartVisible;
  }

  /**
   * Show/hide loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    // Could add spinner or loading animation here
    const buttons = ['scan-page-button', 'scan-all-button', 'clear-button'];
    buttons.forEach(id => {
      if (this.elements[id]) {
        this.elements[id].disabled = loading;
        this.elements[id].style.opacity = loading ? '0.6' : '1';
      }
    });
  }
}

// Export for use in other modules
window.UIManager = UIManager; 