// Token Management: CRUD, enable/disable

let cachedTokens = [];
let currentFilter = localStorage.getItem('tokenFilter') || 'all'; // 'all', 'enabled', 'disabled'
let skipAnimation = false; // 是否跳过动画

// 初始化筛选状态
function initFilterState() {
    const savedFilter = localStorage.getItem('tokenFilter') || 'all';
    currentFilter = savedFilter;
    updateFilterButtonState(savedFilter);
}

// 更新筛选按钮状态
function updateFilterButtonState(filter) {
    document.querySelectorAll('.stat-item').forEach(item => {
        item.classList.remove('active');
    });
    const filterMap = { 'all': 'totalTokens', 'enabled': 'enabledTokens', 'disabled': 'disabledTokens' };
    const activeElement = document.getElementById(filterMap[filter]);
    if (activeElement) {
        activeElement.closest('.stat-item').classList.add('active');
    }
}

// 筛选 Token
function filterTokens(filter) {
    currentFilter = filter;
    localStorage.setItem('tokenFilter', filter); // 持久化筛选状态
    
    updateFilterButtonState(filter);
    
    // 重新渲染
    renderTokens(cachedTokens);
}

async function loadTokens() {
    try {
        const response = await authFetch('/admin/tokens', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        if (data.success) {
            renderTokens(data.data);
        } else {
            showToast(t('messages.loadFailed') + ': ' + (data.message || t('messages.unknownError')), 'error');
        }
    } catch (error) {
        showToast(t('messages.loadTokensFailed') + ': ' + error.message, 'error');
    }
}

// 正在刷新的 Token 集合
const refreshingTokens = new Set();

function renderTokens(tokens) {
    // 只在首次加载时更新缓存
    if (tokens !== cachedTokens) {
        cachedTokens = tokens;
    }
    
    document.getElementById('totalTokens').textContent = tokens.length;
    document.getElementById('enabledTokens').textContent = tokens.filter(t => t.enable).length;
    document.getElementById('disabledTokens').textContent = tokens.filter(t => !t.enable).length;
    
    // 根据筛选条件过滤
    let filteredTokens = tokens;
    if (currentFilter === 'enabled') {
        filteredTokens = tokens.filter(t => t.enable);
    } else if (currentFilter === 'disabled') {
        filteredTokens = tokens.filter(t => !t.enable);
    }
    
    const tokenList = document.getElementById('tokenList');
    if (filteredTokens.length === 0) {
        const emptyText = currentFilter === 'all' ? t('tokens.noTokens') :
                          currentFilter === 'enabled' ? t('tokens.noEnabledTokens') : t('tokens.noDisabledTokens');
        const emptyHint = currentFilter === 'all' ? t('tokens.clickOAuthHint') : t('tokens.clickTotalHint');
        tokenList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">${emptyText}</div>
                <div class="empty-state-hint">${emptyHint}</div>
            </div>
        `;
        return;
    }
    
    // 收集需要自动刷新的过期 Token
    const expiredTokensToRefresh = [];
    
    tokenList.innerHTML = filteredTokens.map((token, index) => {
        const expireTime = new Date(token.timestamp + token.expires_in * 1000);
        const isExpired = expireTime < new Date();
        const isRefreshing = refreshingTokens.has(token.refresh_token);
        const expireStr = expireTime.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
        const cardId = token.refresh_token.substring(0, 8);
        
        // 计算在原始列表中的序号（基于添加顺序）
        const originalIndex = cachedTokens.findIndex(t => t.refresh_token === token.refresh_token);
        const tokenNumber = originalIndex + 1;
        
        // 如果已过期且启用状态，加入待刷新列表
        if (isExpired && token.enable && !isRefreshing) {
            expiredTokensToRefresh.push(token.refresh_token);
        }
        
        // 转义所有用户数据防止 XSS
        const safeRefreshToken = escapeJs(token.refresh_token);
        const safeAccessTokenSuffix = escapeHtml(token.access_token_suffix || '');
        const safeProjectId = escapeHtml(token.projectId || '');
        const safeEmail = escapeHtml(token.email || '');
        const safeProjectIdJs = escapeJs(token.projectId || '');
        const safeEmailJs = escapeJs(token.email || '');
        
        return `
        <div class="token-card ${!token.enable ? 'disabled' : ''} ${isExpired ? 'expired' : ''} ${isRefreshing ? 'refreshing' : ''} ${skipAnimation ? 'no-animation' : ''}" id="card-${escapeHtml(cardId)}">
            <div class="token-header">
                <span class="status ${token.enable ? 'enabled' : 'disabled'}">
                    ${token.enable ? '✅ ' + t('tokens.enabled') : '❌ ' + t('tokens.disabled')}
                </span>
                <div class="token-header-right">
                    <button class="btn-icon" onclick="showTokenDetail('${safeRefreshToken}')" title="${t('tokens.editAll')}">✏️</button>
                    <span class="token-id">#${tokenNumber}</span>
                </div>
            </div>
            <div class="token-info">
                <div class="info-row sensitive-row">
                    <span class="info-label">🎫</span>
                    <span class="info-value sensitive-info" title="${safeAccessTokenSuffix}">${safeAccessTokenSuffix}</span>
                </div>
                <div class="info-row editable sensitive-row" onclick="editField(event, '${safeRefreshToken}', 'projectId', '${safeProjectIdJs}')" title="${t('tooltips.clickToEdit')}">
                    <span class="info-label">📦</span>
                    <span class="info-value sensitive-info">${safeProjectId || t('tokens.clickToSet')}</span>
                    <span class="info-edit-icon">✏️</span>
                </div>
                <div class="info-row editable sensitive-row" onclick="editField(event, '${safeRefreshToken}', 'email', '${safeEmailJs}')" title="${t('tooltips.clickToEdit')}">
                    <span class="info-label">📧</span>
                    <span class="info-value sensitive-info">${safeEmail || t('tokens.clickToSet')}</span>
                    <span class="info-edit-icon">✏️</span>
                </div>
                <div class="info-row ${isExpired ? 'expired-text' : ''}" id="expire-row-${escapeHtml(cardId)}">
                    <span class="info-label">⏰</span>
                    <span class="info-value">${isRefreshing ? '🔄 ' + t('tokens.refreshing') : escapeHtml(expireStr)}${isExpired && !isRefreshing ? ' (' + t('tokens.expired') + ')' : ''}</span>
                    <button class="btn-icon btn-refresh" onclick="manualRefreshToken('${safeRefreshToken}')" title="${t('tooltips.refreshToken')}" ${isRefreshing ? 'disabled' : ''}>🔄</button>
                </div>
            </div>
            <div class="token-quota-inline" id="quota-inline-${escapeHtml(cardId)}">
                <div class="quota-inline-header" onclick="toggleQuotaExpand('${escapeJs(cardId)}', '${safeRefreshToken}')">
                    <span class="quota-inline-summary" id="quota-summary-${escapeHtml(cardId)}">📊 加载中...</span>
                    <span class="quota-inline-toggle" id="quota-toggle-${escapeHtml(cardId)}">▼</span>
                </div>
                <div class="quota-inline-detail hidden" id="quota-detail-${escapeHtml(cardId)}"></div>
            </div>
            <div class="token-actions">
                <button class="btn btn-info btn-xs" onclick="showQuotaModal('${safeRefreshToken}')" title="${t('tokens.quota')}">📊 ${t('buttons.details')}</button>
                <button class="btn ${token.enable ? 'btn-warning' : 'btn-success'} btn-xs" onclick="toggleToken('${safeRefreshToken}', ${!token.enable})" title="${token.enable ? t('buttons.disable') : t('buttons.enable')}">
                    ${token.enable ? '⏸️ ' + t('buttons.disable') : '▶️ ' + t('buttons.enable')}
                </button>
                <button class="btn btn-danger btn-xs" onclick="deleteToken('${safeRefreshToken}')" title="${t('buttons.delete')}">🗑️ ${t('buttons.delete')}</button>
            </div>
        </div>
    `}).join('');
    
    filteredTokens.forEach(token => {
        loadTokenQuotaSummary(token.refresh_token);
    });
    
    updateSensitiveInfoDisplay();
    
    // 重置动画跳过标志
    skipAnimation = false;
    
    // 自动刷新过期的 Token
    if (expiredTokensToRefresh.length > 0) {
        expiredTokensToRefresh.forEach(refreshToken => {
            autoRefreshToken(refreshToken);
        });
    }
}

// 手动刷新 Token
async function manualRefreshToken(refreshToken) {
    if (refreshingTokens.has(refreshToken)) {
        showToast(t('messages.tokenRefreshing'), 'warning');
        return;
    }
    await autoRefreshToken(refreshToken);
}

// 自动刷新过期 Token
async function autoRefreshToken(refreshToken) {
    if (refreshingTokens.has(refreshToken)) return;
    
    refreshingTokens.add(refreshToken);
    const cardId = refreshToken.substring(0, 8);
    
    // 更新 UI 显示刷新中状态
    const card = document.getElementById(`card-${cardId}`);
    const expireRow = document.getElementById(`expire-row-${cardId}`);
    if (card) card.classList.add('refreshing');
    if (expireRow) {
        const valueSpan = expireRow.querySelector('.info-value');
        if (valueSpan) valueSpan.textContent = '🔄 ' + t('tokens.refreshing');
    }
    
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(t('messages.tokenRefreshed'), 'success');
            refreshingTokens.delete(refreshToken);
            loadTokens();
        } else {
            showToast(t('messages.tokenRefreshFailed') + ': ' + (data.message || t('messages.unknownError')), 'error');
            refreshingTokens.delete(refreshToken);
            if (expireRow) {
                const valueSpan = expireRow.querySelector('.info-value');
                if (valueSpan) valueSpan.textContent = '❌ ' + t('tokens.refreshFailed');
            }
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            showToast(t('messages.tokenRefreshFailed') + ': ' + error.message, 'error');
        }
        refreshingTokens.delete(refreshToken);
        if (expireRow) {
            const valueSpan = expireRow.querySelector('.info-value');
            if (valueSpan) valueSpan.textContent = '❌ ' + t('tokens.refreshFailed');
        }
    }
}

function showManualModal() {
    const modal = document.createElement('div');
    modal.className = 'modal form-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">✏️ ${t('modals.manualAdd')}</div>
            <div class="form-row">
                <input type="text" id="modalAccessToken" placeholder="${t('modals.accessTokenRequired')}">
                <input type="text" id="modalRefreshToken" placeholder="${t('modals.refreshTokenRequired')}">
                <input type="number" id="modalExpiresIn" placeholder="${t('modals.expiresIn')}" value="3599">
            </div>
            <p style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 12px;">💡 ${t('modals.expiresInHint')}</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">${t('buttons.cancel')}</button>
                <button class="btn btn-success" onclick="addTokenFromModal()">✅ ${t('buttons.add')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function addTokenFromModal() {
    const modal = document.querySelector('.form-modal');
    const accessToken = document.getElementById('modalAccessToken').value.trim();
    const refreshToken = document.getElementById('modalRefreshToken').value.trim();
    const expiresIn = parseInt(document.getElementById('modalExpiresIn').value);
    
    if (!accessToken || !refreshToken) {
        showToast(t('messages.pleaseInputComplete'), 'warning');
        return;
    }
    
    showLoading(t('messages.addingToken'));
    try {
        const response = await authFetch('/admin/tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn })
        });
        
        const data = await response.json();
        hideLoading();
        if (data.success) {
            modal.remove();
            showToast(t('messages.tokenAdded'), 'success');
            loadTokens();
        } else {
            showToast(data.message || t('messages.addFailed'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast(t('messages.addFailed') + ': ' + error.message, 'error');
    }
}

function editField(event, refreshToken, field, currentValue) {
    event.stopPropagation();
    const row = event.currentTarget;
    const valueSpan = row.querySelector('.info-value');
    
    if (row.querySelector('input')) return;
    
    const fieldLabels = { projectId: 'Project ID', email: t('tokens.email') };
    
    const input = document.createElement('input');
    input.type = field === 'email' ? 'email' : 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';
    input.placeholder = `输入${fieldLabels[field]}`;
    
    valueSpan.style.display = 'none';
    row.insertBefore(input, valueSpan.nextSibling);
    input.focus();
    input.select();
    
    const save = async () => {
        const newValue = input.value.trim();
        input.disabled = true;
        
        try {
            const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ [field]: newValue })
            });
            
            const data = await response.json();
            if (data.success) {
                showToast(t('messages.saved'), 'success');
                loadTokens();
            } else {
                showToast(data.message || t('messages.saveFailed'), 'error');
                cancel();
            }
        } catch (error) {
            showToast(t('messages.saveFailed'), 'error');
            cancel();
        }
    };
    
    const cancel = () => {
        input.remove();
        valueSpan.style.display = '';
    };
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement !== input) {
                if (input.value.trim() !== currentValue) {
                    save();
                } else {
                    cancel();
                }
            }
        }, 100);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            cancel();
        }
    });
}

function showTokenDetail(refreshToken) {
    const token = cachedTokens.find(t => t.refresh_token === refreshToken);
    if (!token) {
        showToast(t('messages.tokenNotExist'), 'error');
        return;
    }
    
    // 转义所有用户数据防止 XSS
    const safeAccessToken = escapeHtml(token.access_token || '');
    const safeRefreshToken = escapeHtml(token.refresh_token);
    const safeRefreshTokenJs = escapeJs(refreshToken);
    const safeProjectId = escapeHtml(token.projectId || '');
    const safeEmail = escapeHtml(token.email || '');
    const expireTimeStr = escapeHtml(new Date(token.timestamp + token.expires_in * 1000).toLocaleString('zh-CN'));
    
    const modal = document.createElement('div');
    modal.className = 'modal form-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">📝 ${t('tokens.tokenDetails')}</div>
            <div class="form-group compact">
                <label>🎫 ${t('tokens.accessTokenReadonly')}</label>
                <div class="token-display">${safeAccessToken}</div>
            </div>
            <div class="form-group compact">
                <label>🔄 ${t('tokens.refreshTokenReadonly')}</label>
                <div class="token-display">${safeRefreshToken}</div>
            </div>
            <div class="form-group compact">
                <label>📦 ${t('tokens.projectId')}</label>
                <input type="text" id="editProjectId" value="${safeProjectId}" placeholder="Project ID">
            </div>
            <div class="form-group compact">
                <label>📧 ${t('tokens.email')}</label>
                <input type="email" id="editEmail" value="${safeEmail}" placeholder="Email">
            </div>
            <div class="form-group compact">
                <label>⏰ ${t('tokens.expireTime')}</label>
                <input type="text" value="${expireTimeStr}" readonly style="background: var(--bg); cursor: not-allowed;">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">${t('buttons.cancel')}</button>
                <button class="btn btn-success" onclick="saveTokenDetail('${safeRefreshTokenJs}')">💾 ${t('buttons.save')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function saveTokenDetail(refreshToken) {
    const projectId = document.getElementById('editProjectId').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    
    showLoading(t('messages.saving'));
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ projectId, email })
        });
        
        const data = await response.json();
        hideLoading();
        if (data.success) {
            document.querySelector('.form-modal').remove();
            showToast(t('messages.saveSuccess'), 'success');
            loadTokens();
        } else {
            showToast(data.message || t('messages.saveFailed'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast(t('messages.saveFailed') + ': ' + error.message, 'error');
    }
}

async function toggleToken(refreshToken, enable) {
    const confirmMsg = enable ? t('modals.enableConfirm') : t('modals.disableConfirm');
    const confirmed = await showConfirm(confirmMsg, t('modals.confirmOperation'));
    if (!confirmed) return;
    
    showLoading(enable ? t('messages.enabling') : t('messages.disabling'));
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ enable })
        });
        
        const data = await response.json();
        hideLoading();
        if (data.success) {
            showToast(enable ? t('messages.enabled') : t('messages.disabled'), 'success');
            skipAnimation = true;
            loadTokens();
        } else {
            showToast(data.message || t('messages.operationFailed'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast(t('messages.operationFailed') + ': ' + error.message, 'error');
    }
}

async function deleteToken(refreshToken) {
    const confirmed = await showConfirm(t('modals.deleteConfirm'), '⚠️ ' + t('modals.confirmOperation'));
    if (!confirmed) return;
    
    showLoading(t('messages.deleting'));
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        hideLoading();
        if (data.success) {
            showToast(t('messages.deleted'), 'success');
            loadTokens();
        } else {
            showToast(data.message || t('messages.deleteFailed'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast(t('messages.deleteFailed') + ': ' + error.message, 'error');
    }
}
