// Abious Foundation Chrome Extension - Background Service Worker
// Manifest V3 - Cross-browser compatible

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Abious Foundation Extension installed:', details.reason);
    
    // Set default options
    chrome.storage.sync.set({
        autoOpen: false,
        notifications: true,
        theme: 'default'
    });
});

// Handle extension icon click (if no popup is defined)
chrome.action.onClicked.addListener((tab) => {
    // This won't fire since we have a popup, but kept for reference
    chrome.tabs.update(tab.id, { url: 'abious_rehabilitation_center2.html' });
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openTab') {
        chrome.tabs.create({ url: message.url, active: true });
        sendResponse({ success: true });
    }
    
    if (message.action === 'getStatus') {
        sendResponse({ 
            status: 'active',
            version: chrome.runtime.getManifest().version 
        });
    }
    
    return true;
});

// Badge update for notifications (optional feature)
function updateBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Context menu for right-click actions (optional)
chrome.contextMenus?.create({
    id: 'abious-home',
    title: 'Go to Abious Foundation',
    contexts: ['all']
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'abious-home') {
        chrome.tabs.update(tab.id, { url: 'abious_rehabilitation_center2.html' });
    }
});

console.log('Abious Foundation Background Service Worker loaded');
