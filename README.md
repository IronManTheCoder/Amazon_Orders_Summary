# 💰 Amazon Orders Extension

A powerful Chrome extension that provides instant insights into your Amazon spending with visual charts and comprehensive order analysis.

## 🌟 Features

### 📊 **Complete Order Analysis**
- **One-Click Calculation**: Single button calculates orders across all pages automatically
- **Multi-Page Scanning**: Intelligently scans through all your order history pages
- **Real-Time Progress**: Live updates during scanning process
- **Accurate Totals**: Precise calculation with duplicate detection

### 📈 **Visual Analytics**
- **Monthly Breakdown Chart**: Beautiful horizontal bar chart showing spending by month
- **Interactive Display**: Toggle chart view on/off
- **Responsive Design**: Clean, professional interface that adapts to your screen

### 🎯 **Smart Detection**
- **Robust Order Recognition**: Multiple detection patterns for maximum accuracy
- **Date Extraction**: Automatically categorizes orders by month and year
- **Error Handling**: Comprehensive validation and error recovery

### 🚀 **Performance**
- **Background Processing**: Multi-page scanning doesn't interfere with browsing
- **Modular Architecture**: Clean, maintainable code structure
- **Memory Efficient**: Optimized for large order histories

## 🛠️ Installation

### From Source
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Amazon_Orders_Summary
   ```

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `Amazon_Orders_Summary` folder

3. **Ready to use**! Visit your Amazon orders page.

## 📱 Usage

### Getting Started
1. **Navigate** to your Amazon orders page:
   - Go to `amazon.com/your-orders`
   - Or any Amazon orders URL

2. **Launch Extension**:
   - The extension automatically appears as a draggable panel
   - Default position: Left side of screen

3. **Calculate Orders**:
   - Click **"📊 Calculate All Orders"**
   - Watch real-time progress as it scans all pages
   - View total spending and order count

### Chart Features
- **Toggle Chart**: Click "📊 Chart View" to show/hide monthly breakdown
- **Monthly Data**: See spending organized by month and year
- **Visual Insights**: Quickly identify spending patterns

### Interface Controls
- **Drag & Drop**: Move the panel anywhere on screen
- **Position Cycling**: Click the position button to cycle through preset locations
- **Reset**: Clear all data and start fresh

## 🏗️ Architecture

### Modular Design
The extension uses a clean, modular architecture for maintainability:

```
📦 Amazon Orders Extension
├── 📄 manifest.json          # Extension configuration
├── 📄 content.js             # Main orchestrator (334 lines)
├── 📄 background.js          # Service worker (95 lines)
├── 📄 popup.js              # Extension popup
├── 📄 popup.html            # Popup interface
├── 📄 popup.css             # Popup styling
└── 📁 modules/
    ├── 📊 OrderScanner.js    # Order detection & parsing
    ├── 📈 ChartRenderer.js   # Chart rendering engine
    ├── 🎨 UIManager.js       # UI management & events
    └── 🔄 BackgroundScanner.js # Multi-page scanning
```

### Key Components

#### 🔍 **OrderScanner**
- Detects Amazon order elements using multiple patterns
- Extracts order totals, dates, and metadata
- Validates and filters legitimate orders
- Handles various Amazon page layouts

#### 📊 **ChartRenderer**
- Renders horizontal bar charts using HTML5 Canvas
- Configurable styling and dimensions
- Supports data export and statistics
- Responsive design for different screen sizes

#### 🎨 **UIManager**
- Creates and manages the floating panel interface
- Handles drag & drop, positioning, and interactions
- Event management and state coordination
- Professional UI with hover effects and animations

#### 🔄 **BackgroundScanner**
- Manages multi-page scanning in background tabs
- Aggregates data from multiple pages
- Handles tab lifecycle and error recovery
- Efficient memory usage during large scans

## 🎯 Supported Pages

The extension works on all Amazon order-related pages:
- `amazon.com/your-orders`
- `amazon.com/gp/css/order-history`
- `amazon.com/gp/your-account/order-history`
- All time-filtered order views (yearly, monthly, etc.)

## 🔧 Technical Details

### Browser Compatibility
- **Chrome**: Full support (Manifest V3)
- **Edge**: Compatible with Chromium-based Edge
- **Other Browsers**: Not currently supported

### Permissions
- `tabs`: For multi-page scanning
- `scripting`: For content injection
- `storage`: For settings persistence
- Host permissions for Amazon domains

### Performance
- **Memory**: ~2-5MB typical usage
- **CPU**: Minimal impact during scanning
- **Network**: No external requests (privacy-focused)

## 🛡️ Privacy & Security

### Data Handling
- **Local Only**: All data processing happens locally
- **No External Servers**: No data sent to third parties
- **No Storage**: Order data is not permanently stored
- **Session-Based**: Data cleared when page refreshes

### Security Features
- **Content Security**: Runs in isolated extension context
- **Permission Minimal**: Only requests necessary permissions
- **Code Validation**: All injected code is validated

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Appearing
- Refresh the Amazon orders page
- Check if extension is enabled in `chrome://extensions/`
- Verify you're on a supported Amazon page

#### Scanning Stops Early
- Check browser console for errors
- Ensure stable internet connection
- Try refreshing and scanning again

#### Chart Not Showing
- Click "📊 Chart View" button to toggle
- Ensure orders were found during scanning
- Check that monthly data is available

### Debug Mode
Enable developer tools console to see detailed logging:
1. Press `F12` to open DevTools
2. Go to Console tab
3. Look for extension messages starting with 🚀, 📊, ✅

## 🔄 Updates & Changelog

### Version 0.1.1 (Current)
- ✅ Modular architecture implementation
- ✅ Single-button interface
- ✅ Enhanced monthly charts
- ✅ Improved multi-page scanning
- ✅ Professional UI redesign

### Planned Features
- 📅 Date range filtering
- 💾 Export functionality
- 📊 Additional chart types
- 🔍 Search and filtering
- 📱 Mobile optimization

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Make changes to the modular components
3. Test on Amazon orders pages
4. Submit pull requests

### Code Style
- ES6+ JavaScript
- Modular architecture
- Comprehensive error handling
- JSDoc documentation
- Clean, readable code

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Create an issue with detailed information

---

**Made with ❤️ for Amazon shoppers who want to understand their spending patterns**