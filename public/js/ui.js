// UI Components: Toast, Modal, Loading

function showToast(message, type = 'info', title = '') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titleKeys = { success: 'toast.success', error: 'toast.error', warning: 'toast.warning', info: 'toast.info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Escape input to prevent XSS
    const safeTitle = escapeHtml(title || t(titleKeys[type]) || type);
    const safeMessage = escapeHtml(message);
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${safeTitle}</div>
            <div class="toast-message">${safeMessage}</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(message, title = '确认操作') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        // 转义用户输入防止 XSS
        const safeTitle = escapeHtml(title);
        const safeMessage = escapeHtml(message);
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">${safeTitle}</div>
                <div class="modal-message">${safeMessage}</div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); window.modalResolve(false)">${t('buttons.cancel')}</button>
                    <button class="btn btn-danger" onclick="this.closest('.modal').remove(); window.modalResolve(true)">${t('buttons.confirm')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
        window.modalResolve = resolve;
    });
}

function showLoading(text = '处理中...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    // 转义用户输入防止 XSS
    const safeText = escapeHtml(text);
    overlay.innerHTML = `<div class="spinner"></div><div class="loading-text">${safeText}</div>`;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

function switchTab(tab, saveState = true) {
    // 更新html元素的class以防止闪烁
    if (tab === 'settings') {
        document.documentElement.classList.add('tab-settings');
    } else {
        document.documentElement.classList.remove('tab-settings');
    }
    
    // 移除所有tab的active状态
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // 找到对应的tab按钮并激活
    const targetTab = document.querySelector(`.tab[data-tab="${tab}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    const tokensPage = document.getElementById('tokensPage');
    const settingsPage = document.getElementById('settingsPage');
    
    // 隐藏所有页面并移除动画类
    tokensPage.classList.add('hidden');
    tokensPage.classList.remove('page-enter');
    settingsPage.classList.add('hidden');
    settingsPage.classList.remove('page-enter');
    
    // 显示对应页面并添加入场动画
    if (tab === 'tokens') {
        tokensPage.classList.remove('hidden');
        // 触发重排以重新播放动画
        void tokensPage.offsetWidth;
        tokensPage.classList.add('page-enter');
    } else if (tab === 'settings') {
        settingsPage.classList.remove('hidden');
        // 触发重排以重新播放动画
        void settingsPage.offsetWidth;
        settingsPage.classList.add('page-enter');
        loadConfig();
    }
    
    // 保存当前Tab状态到localStorage
    if (saveState) {
        localStorage.setItem('currentTab', tab);
    }
}

// 恢复Tab状态
function restoreTabState() {
    const savedTab = localStorage.getItem('currentTab');
    if (savedTab && (savedTab === 'tokens' || savedTab === 'settings')) {
        switchTab(savedTab, false);
    }
}
