# Abious Foundation Browser Extension

A cross-browser compatible extension for accessing Abious Foundation Rehabilitation Center resources.

## Features

- � Quick access to member portal, news, and registration
- 🔒 Security and Privacy policy links
- 🚀 Fast navigation to all website sections
- 📱 Works on Chrome, Edge, Brave, Opera, and Firefox

## Browser Compatibility

| Browser | Supported | Version |
|---------|-----------|---------|
| Google Chrome | ✅ | 88+ |
| Microsoft Edge | ✅ | 88+ |
| Brave | ✅ | Latest |
| Opera | ✅ | 75+ |
| Firefox | ✅ | 109+ |

## Installation

### Chrome, Edge, Brave, Opera

1. Open the `chrome-extension` folder in your file explorer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `chrome-extension` folder
6. The extension will be installed and ready to use

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Navigate to the `chrome-extension` folder
4. Select `manifest.json`
5. Note: Firefox will require the extension to be reloaded after each browser restart

## Extension Icons

For the extension to display properly, add icon images to the `chrome-extension/images/` folder:

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

You can create these using:
- Any image editing software (Photoshop, GIMP, etc.)
- Online tools like realfavicongenerator.net
- Or use the included placeholder colors

## Updating URLs

To update the website URLs in the extension, edit `popup.js` and modify the `URLs` object:

```javascript
const URLs = {
    home: 'your-domain.com/abious_rehabilitation_center2.html',
    members: 'your-domain.com/members.html',
    news: 'your-domain.com/news.html',
    register: 'your-domain.com/register.html',
    security: 'your-domain.com/security-policy.html',
    privacy: 'your-domain.com/privacy-policy.html'
};
```

## Permissions

The extension requests the following minimal permissions:
- `activeTab` - To navigate in the current tab
- `storage` - To store user preferences
- `tabs` - To manage browser tabs

## Security

This extension follows security best practices:
- Manifest V3 (latest security standards)
- Minimal permissions required
- No access to browsing history
- No data collection or tracking
- Local storage only

## Support

For issues or questions about the extension:
- Email: support@abiousfoundation.org
- Website: abiousfoundation.org

## Version

Current Version: 1.0.0
Last Updated: March 2026
