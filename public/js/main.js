// Main entry: initialization and event bindings

// Initialize i18n first, then other components
(async function() {
    // Initialize i18n and wait for translations to load
    await initI18n();
    
    // Initialize other components
    initFontSize();
    initSensitiveInfo();
    initFilterState();
    
    // If logged in, show main content
    if (authToken) {
        showMainContent();
        restoreTabState();
        loadTokens();
        if (localStorage.getItem('currentTab') === 'settings') {
            loadConfig();
        }
    }
})();

// Login form submit
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn.disabled) return;
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    btn.disabled = true;
    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.textContent = t('messages.processing');
    
    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            showToast(t('toast.success'), 'success');
            showMainContent();
            loadTokens();
            loadConfig();
        } else {
            showToast(data.message || t('messages.unknownError'), 'error');
        }
    } catch (error) {
        showToast(t('messages.operationFailed') + ': ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = originalText;
    }
});

// Config form submit
document.getElementById('configForm').addEventListener('submit', saveConfig);

