/**
 * ChartRenderer Module
 * Handles chart rendering for monthly spending data
 */
class ChartRenderer {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
    this.config = {
      leftPadding: 50,
      rightPadding: 70,
      topPadding: 20,
      bottomPadding: 20,
      barSpacing: 4,
      barColor: '#007185',
      textColor: '#333',
      axisColor: '#ddd',
      monthFont: '11px Arial',
      valueFont: '10px Arial'
    };
  }

  /**
   * Initialize the chart renderer
   * @returns {boolean} Success status
   */
  init() {
    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas) {
      console.error(`Canvas element with id '${this.canvasId}' not found`);
      return false;
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('Could not get 2D context from canvas');
      return false;
    }
    
    return true;
  }

  /**
   * Draw monthly chart with given data
   * @param {Object} monthlyData - Monthly spending data
   */
  drawChart(monthlyData) {
    if (!this.ctx) {
      if (!this.init()) return;
    }

    if (!monthlyData || Object.keys(monthlyData).length === 0) {
      this.clearChart();
      return;
    }

    // Clear canvas
    this.clearChart();

    // Sort months chronologically
    const sortedEntries = this.sortMonthsChronologically(monthlyData);
    if (sortedEntries.length === 0) return;

    // Calculate dimensions
    const dimensions = this.calculateDimensions(sortedEntries);
    
    // Draw chart elements
    this.drawAxes(dimensions);
    this.drawBars(sortedEntries, dimensions);
  }

  /**
   * Clear the chart canvas
   */
  clearChart() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Sort monthly data chronologically
   * @param {Object} monthlyData - Monthly data object
   * @returns {Array} Sorted array of [month, data] entries
   */
  sortMonthsChronologically(monthlyData) {
    return Object.entries(monthlyData).sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA - dateB;
    });
  }

  /**
   * Calculate chart dimensions and scaling
   * @param {Array} sortedEntries - Sorted month entries
   * @returns {Object} Dimension calculations
   */
  calculateDimensions(sortedEntries) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const chartWidth = width - this.config.leftPadding - this.config.rightPadding;
    const chartHeight = height - this.config.topPadding - this.config.bottomPadding;
    
    // Find max value for scaling
    const maxValue = Math.max(...sortedEntries.map(([_, data]) => data.total));
    const scale = chartWidth / maxValue;
    
    // Calculate bar dimensions
    const totalSpacing = this.config.barSpacing * (sortedEntries.length - 1);
    const barHeight = (chartHeight - totalSpacing) / sortedEntries.length;
    
    return {
      width,
      height,
      chartWidth,
      chartHeight,
      maxValue,
      scale,
      barHeight
    };
  }

  /**
   * Draw chart axes
   * @param {Object} dimensions - Chart dimensions
   */
  drawAxes(dimensions) {
    this.ctx.strokeStyle = this.config.axisColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    // Y-axis (left side)
    this.ctx.moveTo(this.config.leftPadding, this.config.topPadding);
    this.ctx.lineTo(this.config.leftPadding, dimensions.height - this.config.bottomPadding);
    
    // X-axis (bottom)
    this.ctx.moveTo(this.config.leftPadding, dimensions.height - this.config.bottomPadding);
    this.ctx.lineTo(dimensions.width - this.config.rightPadding, dimensions.height - this.config.bottomPadding);
    
    this.ctx.stroke();
  }

  /**
   * Draw horizontal bars with labels
   * @param {Array} sortedEntries - Sorted month entries
   * @param {Object} dimensions - Chart dimensions
   */
  drawBars(sortedEntries, dimensions) {
    this.ctx.fillStyle = this.config.barColor;
    
    sortedEntries.forEach(([month, data], index) => {
      const y = this.config.topPadding + index * (dimensions.barHeight + this.config.barSpacing);
      const barLength = data.total * dimensions.scale;
      const x = this.config.leftPadding;
      
      // Draw bar
      this.ctx.fillStyle = this.config.barColor;
      this.ctx.fillRect(x, y, barLength, dimensions.barHeight);
      
      // Draw month label
      this.drawMonthLabel(month, x, y, dimensions.barHeight);
      
      // Draw value label
      this.drawValueLabel(data.total, x + barLength, y, dimensions.barHeight);
    });
  }

  /**
   * Draw month label on the left
   * @param {string} month - Month string
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} barHeight - Bar height
   */
  drawMonthLabel(month, x, y, barHeight) {
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.textAlign = 'right';
    this.ctx.font = this.config.monthFont;
    
    const monthLabel = month.split(' ')[0].substring(0, 3);
    this.ctx.fillText(monthLabel, this.config.leftPadding - 5, y + barHeight / 2 + 4);
  }

  /**
   * Draw value label at the end of bar
   * @param {number} value - Value to display
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} barHeight - Bar height
   */
  drawValueLabel(value, x, y, barHeight) {
    this.ctx.textAlign = 'left';
    this.ctx.font = this.config.valueFont;
    this.ctx.fillStyle = this.config.textColor;
    
    this.ctx.fillText(`$${value.toFixed(0)}`, x + 5, y + barHeight / 2 + 4);
  }

  /**
   * Update chart configuration
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Resize chart (useful for responsive design)
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Export chart as image data URL
   * @param {string} format - Image format (default: 'png')
   * @returns {string} Data URL
   */
  exportChart(format = 'png') {
    if (this.canvas) {
      return this.canvas.toDataURL(`image/${format}`);
    }
    return null;
  }

  /**
   * Check if chart has data
   * @param {Object} monthlyData - Monthly data to check
   * @returns {boolean} Whether chart has data to display
   */
  hasData(monthlyData) {
    return monthlyData && Object.keys(monthlyData).length > 0;
  }

  /**
   * Get chart statistics
   * @param {Object} monthlyData - Monthly data
   * @returns {Object} Chart statistics
   */
  getStats(monthlyData) {
    if (!this.hasData(monthlyData)) {
      return { monthCount: 0, totalAmount: 0, averagePerMonth: 0 };
    }

    const entries = Object.entries(monthlyData);
    const totalAmount = entries.reduce((sum, [_, data]) => sum + data.total, 0);
    
    return {
      monthCount: entries.length,
      totalAmount,
      averagePerMonth: totalAmount / entries.length,
      maxMonth: entries.reduce((max, [month, data]) => 
        data.total > max.amount ? { month, amount: data.total } : max, 
        { month: '', amount: 0 }
      ),
      minMonth: entries.reduce((min, [month, data]) => 
        data.total < min.amount ? { month, amount: data.total } : min, 
        { month: '', amount: Infinity }
      )
    };
  }
}

// Export for use in other modules
window.ChartRenderer = ChartRenderer; 