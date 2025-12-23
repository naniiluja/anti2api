// Quota Management: view, refresh, cache

let currentQuotaToken = null;

const quotaCache = {
    data: {},
    ttl: 5 * 60 * 1000,
    
    get(refreshToken) {
        const cached = this.data[refreshToken];
        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.ttl) {
            delete this.data[refreshToken];
            return null;
        }
        return cached.data;
    },
    
    set(refreshToken, data) {
        this.data[refreshToken] = { data, timestamp: Date.now() };
    },
    
    clear(refreshToken) {
        if (refreshToken) {
            delete this.data[refreshToken];
        } else {
            this.data = {};
        }
    }
};

async function loadTokenQuotaSummary(refreshToken) {
    const cardId = refreshToken.substring(0, 8);
    const summaryEl = document.getElementById(`quota-summary-${cardId}`);
    if (!summaryEl) return;
    
    const cached = quotaCache.get(refreshToken);
    if (cached) {
        renderQuotaSummary(summaryEl, cached);
        return;
    }
    
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.success && data.data && data.data.models) {
            quotaCache.set(refreshToken, data.data);
            renderQuotaSummary(summaryEl, data.data);
        } else {
            const errMsg = escapeHtml(data.message || t('messages.unknownError'));
            summaryEl.innerHTML = `<span class="quota-summary-error">📊 ${errMsg}</span>`;
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('loadQuotaSummary failed:', error);
            summaryEl.innerHTML = `<span class="quota-summary-error">📊 ${t('quota.loadFailed')}</span>`;
        }
    }
}

function renderQuotaSummary(summaryEl, quotaData) {
    const models = quotaData.models;
    const modelEntries = Object.entries(models);
    
    if (modelEntries.length === 0) {
        summaryEl.textContent = '📊 ' + t('quota.noQuota');
        return;
    }
    
    let minModel = modelEntries[0][0];
    let minQuota = modelEntries[0][1];
    modelEntries.forEach(([modelId, quota]) => {
        if (quota.remaining < minQuota.remaining) {
            minQuota = quota;
            minModel = modelId;
        }
    });
    
    const percentage = minQuota.remaining * 100;
    const percentageText = `${percentage.toFixed(2)}%`;
    const shortName = escapeHtml(minModel.replace('models/', '').replace('publishers/google/', '').split('/').pop());
    const safeMinModel = escapeHtml(minModel);
    const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
    
    summaryEl.innerHTML = `
        <span class="quota-summary-icon">📊</span>
        <span class="quota-summary-model" title="${safeMinModel}">${shortName}</span>
        <span class="quota-summary-bar"><span style="width:${percentage}%;background:${barColor}"></span></span>
        <span class="quota-summary-pct">${percentageText}</span>
    `;
}

async function toggleQuotaExpand(cardId, refreshToken) {
    const detailEl = document.getElementById(`quota-detail-${cardId}`);
    const toggleEl = document.getElementById(`quota-toggle-${cardId}`);
    if (!detailEl || !toggleEl) return;
    
    const isHidden = detailEl.classList.contains('hidden');
    
    if (isHidden) {
        detailEl.classList.remove('hidden');
        detailEl.classList.remove('collapsing');
        toggleEl.classList.add('expanded');
        
        if (!detailEl.dataset.loaded) {
            detailEl.innerHTML = '<div class="quota-loading-small">' + t('quota.loading') + '</div>';
            await loadQuotaDetail(cardId, refreshToken);
            detailEl.dataset.loaded = 'true';
        }
    } else {
        // 添加收起动画
        detailEl.classList.add('collapsing');
        toggleEl.classList.remove('expanded');
        
        // 动画结束后隐藏
        setTimeout(() => {
            detailEl.classList.add('hidden');
            detailEl.classList.remove('collapsing');
        }, 200);
    }
}

async function loadQuotaDetail(cardId, refreshToken) {
    const detailEl = document.getElementById(`quota-detail-${cardId}`);
    if (!detailEl) return;
    
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.success && data.data && data.data.models) {
            const models = data.data.models;
            const modelEntries = Object.entries(models);
            
            if (modelEntries.length === 0) {
                detailEl.innerHTML = '<div class="quota-empty-small">' + t('quota.noQuotaInfo') + '</div>';
                return;
            }
            
            const grouped = { claude: [], gemini: [], other: [] };
            modelEntries.forEach(([modelId, quota]) => {
                const item = { modelId, quota };
                if (modelId.toLowerCase().includes('claude')) grouped.claude.push(item);
                else if (modelId.toLowerCase().includes('gemini')) grouped.gemini.push(item);
                else grouped.other.push(item);
            });
            
            let html = '<div class="quota-detail-grid">';
            
            const renderGroup = (items, icon) => {
                if (items.length === 0) return '';
                let groupHtml = '';
                items.forEach(({ modelId, quota }) => {
                    const percentage = quota.remaining * 100;
                    const percentageText = `${percentage.toFixed(2)}%`;
                    const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
                    const shortName = escapeHtml(modelId.replace('models/', '').replace('publishers/google/', '').split('/').pop());
                    const safeModelId = escapeHtml(modelId);
                    const safeResetTime = escapeHtml(quota.resetTime);
                    groupHtml += `
                        <div class="quota-detail-row" title="${safeModelId} - ${t('quota.reset')}: ${safeResetTime}">
                            <span class="quota-detail-icon">${icon}</span>
                            <span class="quota-detail-name">${shortName}</span>
                            <span class="quota-detail-bar"><span style="width:${percentage}%;background:${barColor}"></span></span>
                            <span class="quota-detail-pct">${percentageText}</span>
                        </div>
                    `;
                });
                return groupHtml;
            };
            
            html += renderGroup(grouped.claude, '🤖');
            html += renderGroup(grouped.gemini, '💎');
            html += renderGroup(grouped.other, '🔧');
            html += '</div>';
            html += `<button class="btn btn-info btn-xs quota-refresh-btn" onclick="refreshInlineQuota('${escapeJs(cardId)}', '${escapeJs(refreshToken)}')">🔄 ${t('buttons.refreshQuota')}</button>`;
            
            detailEl.innerHTML = html;
        } else {
            const errMsg = escapeHtml(data.message || '未知错误');
            detailEl.innerHTML = `<div class="quota-error-small">${t('quota.loadFailed')}: ${errMsg}</div>`;
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            detailEl.innerHTML = `<div class="quota-error-small">${t('messages.networkError')}</div>`;
        }
    }
}

async function refreshInlineQuota(cardId, refreshToken) {
    const detailEl = document.getElementById(`quota-detail-${cardId}`);
    const summaryEl = document.getElementById(`quota-summary-${cardId}`);
    
    if (detailEl) detailEl.innerHTML = '<div class="quota-loading-small">' + t('quota.refreshing') + '</div>';
    if (summaryEl) summaryEl.textContent = '📊 ' + t('quota.refreshing');
    
    quotaCache.clear(refreshToken);
    
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas?refresh=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success && data.data) {
            quotaCache.set(refreshToken, data.data);
        }
    } catch (e) {}
    
    await loadTokenQuotaSummary(refreshToken);
    await loadQuotaDetail(cardId, refreshToken);
}

async function showQuotaModal(refreshToken) {
    currentQuotaToken = refreshToken;
    
    const activeIndex = cachedTokens.findIndex(t => t.refresh_token === refreshToken);
    
    const emailTabs = cachedTokens.map((t, index) => {
        const email = t.email || window.t('tokens.unknown');
        const shortEmail = email.length > 20 ? email.substring(0, 17) + '...' : email;
        const isActive = index === activeIndex;
        const safeEmail = escapeHtml(email);
        const safeShortEmail = escapeHtml(shortEmail);
        return `<button type="button" class="quota-tab${isActive ? ' active' : ''}" data-index="${index}" onclick="switchQuotaAccountByIndex(${index})" title="${safeEmail}">${safeShortEmail}</button>`;
    }).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quotaModal';
    modal.innerHTML = `
        <div class="modal-content modal-xl">
            <div class="quota-modal-header">
                <div class="modal-title">📊 ${window.t('modals.quotaTitle')}</div>
                <div class="quota-update-time" id="quotaUpdateTime"></div>
            </div>
            <div class="quota-tabs" id="quotaEmailList">
                ${emailTabs}
            </div>
            <div id="quotaContent" class="quota-container">
                <div class="quota-loading">${window.t('quota.loading')}</div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-info btn-sm" id="quotaRefreshBtn" onclick="refreshQuotaData()">🔄 ${window.t('buttons.refresh')}</button>
                <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal').remove()">${window.t('buttons.close')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    await loadQuotaData(refreshToken);
    
    const tabsContainer = document.getElementById('quotaEmailList');
    if (tabsContainer) {
        tabsContainer.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                tabsContainer.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
}

async function switchQuotaAccountByIndex(index) {
    if (index < 0 || index >= cachedTokens.length) return;
    
    const token = cachedTokens[index];
    currentQuotaToken = token.refresh_token;
    
    document.querySelectorAll('.quota-tab').forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    await loadQuotaData(token.refresh_token);
}

async function switchQuotaAccount(refreshToken) {
    const index = cachedTokens.findIndex(t => t.refresh_token === refreshToken);
    if (index >= 0) {
        await switchQuotaAccountByIndex(index);
    }
}

async function loadQuotaData(refreshToken, forceRefresh = false) {
    const quotaContent = document.getElementById('quotaContent');
    if (!quotaContent) return;
    
    const refreshBtn = document.getElementById('quotaRefreshBtn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ ' + t('quota.loading');
    }
    
    if (!forceRefresh) {
        const cached = quotaCache.get(refreshToken);
        if (cached) {
            renderQuotaModal(quotaContent, cached);
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 ' + t('buttons.refresh');
            }
            return;
        }
    } else {
        quotaCache.clear(refreshToken);
    }
    
    quotaContent.innerHTML = '<div class="quota-loading">' + t('quota.loading') + '</div>';
    
    try {
        const url = `/admin/tokens/${encodeURIComponent(refreshToken)}/quotas${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            quotaCache.set(refreshToken, data.data);
            renderQuotaModal(quotaContent, data.data);
        } else {
            quotaContent.innerHTML = `<div class="quota-error">${t('quota.loadFailed')}: ${escapeHtml(data.message)}</div>`;
        }
    } catch (error) {
        if (quotaContent) {
            quotaContent.innerHTML = `<div class="quota-error">${t('quota.loadFailed')}: ${escapeHtml(error.message)}</div>`;
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 ' + t('buttons.refresh');
        }
    }
}

async function refreshQuotaData() {
    if (currentQuotaToken) {
        await loadQuotaData(currentQuotaToken, true);
    }
}

function renderQuotaModal(quotaContent, quotaData) {
    const models = quotaData.models;
    
    const updateTimeEl = document.getElementById('quotaUpdateTime');
    if (updateTimeEl && quotaData.lastUpdated) {
        const lastUpdated = new Date(quotaData.lastUpdated).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        updateTimeEl.textContent = `${t('modals.updatedAt')} ${lastUpdated}`;
    }
    
    if (Object.keys(models).length === 0) {
        quotaContent.innerHTML = '<div class="quota-empty">' + t('quota.noQuotaInfo') + '</div>';
        return;
    }
    
    const grouped = { claude: [], gemini: [], other: [] };
    Object.entries(models).forEach(([modelId, quota]) => {
        const item = { modelId, quota };
        if (modelId.toLowerCase().includes('claude')) grouped.claude.push(item);
        else if (modelId.toLowerCase().includes('gemini')) grouped.gemini.push(item);
        else grouped.other.push(item);
    });
    
    let html = '';
    
    const renderGroup = (items, title) => {
        if (items.length === 0) return '';
        let groupHtml = `<div class="quota-group-title">${escapeHtml(title)}</div><div class="quota-grid">`;
        items.forEach(({ modelId, quota }) => {
            const percentage = quota.remaining * 100;
            const percentageText = `${percentage.toFixed(2)}%`;
            const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
            const shortName = escapeHtml(modelId.replace('models/', '').replace('publishers/google/', ''));
            const safeModelId = escapeHtml(modelId);
            const safeResetTime = escapeHtml(quota.resetTime);
            groupHtml += `
                <div class="quota-item">
                    <div class="quota-model-name" title="${safeModelId}">${shortName}</div>
                    <div class="quota-bar-container">
                        <div class="quota-bar" style="width: ${percentage}%; background: ${barColor};"></div>
                    </div>
                    <div class="quota-info-row">
                        <span class="quota-reset">${t('quota.reset')}: ${safeResetTime}</span>
                        <span class="quota-percentage">${percentageText}</span>
                    </div>
                </div>
            `;
        });
        groupHtml += '</div>';
        return groupHtml;
    };
    
    html += renderGroup(grouped.claude, '🤖 Claude');
    html += renderGroup(grouped.gemini, '💎 Gemini');
    html += renderGroup(grouped.other, '🔧 ' + t('quota.other'));
    
    quotaContent.innerHTML = html;
}
