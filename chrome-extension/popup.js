// Abious Foundation Chrome Extension - Popup Script
// Cross-browser compatible (Chrome, Edge, Brave, Opera, Firefox)

// Default URLs - update these for your production deployment
const URLs = {
    home: 'abious_rehabilitation_center2.html',
    members: 'members.html',
    news: 'news.html',
    register: 'register.html',
    security: 'security-policy.html',
    privacy: 'privacy-policy.html'
};

// Get current tab and navigate to the specified URL
async function navigateTo(url) {
    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
            // Navigate the current tab to the URL
            await chrome.tabs.update(tab.id, { url: url });
        } else {
            // Create a new tab if none exists
            await chrome.tabs.create({ url: url, active: true });
        }
        
        // Update status
        document.getElementById('status-text').textContent = 
            `Navigating to ${url}...`;
        
        // Close popup after a short delay
        setTimeout(() => window.close(), 500);
    } catch (error) {
        console.error('Navigation error:', error);
        document.getElementById('status-text').textContent = 
            'Error: Unable to navigate. Please try again.';
    }
}

// Initialize button event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Home button
    document.getElementById('btn-home').addEventListener('click', function() {
        navigateTo(URLs.home);
    });

    // Members button
    document.getElementById('btn-members').addEventListener('click', function() {
        navigateTo(URLs.members);
    });

    // News button
    document.getElementById('btn-news').addEventListener('click', function() {
        navigateTo(URLs.news);
    });

    // Register button
    document.getElementById('btn-register').addEventListener('click', function() {
        navigateTo(URLs.register);
    });

    // Security policy button
    document.getElementById('btn-security').addEventListener('click', function() {
        navigateTo(URLs.security);
    });

    // Privacy policy button
    document.getElementById('btn-privacy').addEventListener('click', function() {
        navigateTo(URLs.privacy);
    });

    // Footer links
    document.getElementById('link-security').addEventListener('click', function(e) {
        e.preventDefault();
        navigateTo(URLs.security);
    });

    document.getElementById('link-privacy').addEventListener('click', function(e) {
        e.preventDefault();
        navigateTo(URLs.privacy);
    });

    document.getElementById('link-support').addEventListener('click', function(e) {
        e.preventDefault();
        navigateTo(URLs.home + '#contact');
    });

    // Check and update extension status on load
    checkExtensionStatus();
});

// Check extension status and display
function checkExtensionStatus() {
    const statusElement = document.getElementById('status-text');
    
    // Check if running in browser
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        const manifest = chrome.runtime.getManifest();
        statusElement.textContent = `✓ Extension v${manifest.version} active | Ready to use`;
    } else {
        statusElement.textContent = 'Extension is active and ready to use.';
    }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const focusedElement = document.activeElement;
        if (focusedElement.classList.contains('link-btn')) {
            focusedElement.click();
        }
    }
});
