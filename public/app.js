let authToken = localStorage.getItem('authToken');
let oauthPort = null;

// 字体大小设置
function initFontSize() {
    const savedSize = localStorage.getItem('fontSize') || '18';
    document.documentElement.style.setProperty('--font-size-base', savedSize + 'px');
    updateFontSizeInputs(savedSize);
}

function changeFontSize(size) {
    // 限制范围
    size = Math.max(10, Math.min(24, parseInt(size) || 14));
    document.documentElement.style.setProperty('--font-size-base', size + 'px');
    localStorage.setItem('fontSize', size);
    updateFontSizeInputs(size);
}

function updateFontSizeInputs(size) {
    const rangeInput = document.getElementById('fontSizeRange');
    const numberInput = document.getElementById('fontSizeInput');
    if (rangeInput) rangeInput.value = size;
    if (numberInput) numberInput.value = size;
}

// 页面加载时初始化字体大小
initFontSize();

// 敏感信息隐藏功能 - 默认隐藏
// localStorage 存储的是字符串 'true' 或 'false'
// 如果没有存储过，默认为隐藏状态
let sensitiveInfoHidden = localStorage.getItem('sensitiveInfoHidden') !== 'false';

function initSensitiveInfo() {
    updateSensitiveInfoDisplay();
    updateSensitiveBtn();
}

function toggleSensitiveInfo() {
    sensitiveInfoHidden = !sensitiveInfoHidden;
    localStorage.setItem('sensitiveInfoHidden', sensitiveInfoHidden);
    updateSensitiveInfoDisplay();
    updateSensitiveBtn();
}

function updateSensitiveBtn() {
    const btn = document.getElementById('toggleSensitiveBtn');
    if (btn) {
        if (sensitiveInfoHidden) {
            btn.innerHTML = '🙈 隐藏';
            btn.title = '点击显示敏感信息';
            btn.classList.remove('btn-info');
            btn.classList.add('btn-secondary');
        } else {
            btn.innerHTML = '👁️ 显示';
            btn.title = '点击隐藏敏感信息';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-info');
        }
    }
}

function updateSensitiveInfoDisplay() {
    document.querySelectorAll('.sensitive-info').forEach(el => {
        if (sensitiveInfoHidden) {
            el.dataset.original = el.textContent;
            el.textContent = '••••••';
            el.classList.add('blurred');
        } else if (el.dataset.original) {
            el.textContent = el.dataset.original;
            el.classList.remove('blurred');
        }
    });
}

// 页面加载时初始化敏感信息状态
initSensitiveInfo();
const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs'
].join(' ');

// 封装fetch，自动处理401
const authFetch = async (url, options = {}) => {
    const response = await fetch(url, options);
    if (response.status === 401) {
        silentLogout();
        showToast('登录已过期，请重新登录', 'warning');
        throw new Error('Unauthorized');
    }
    return response;
};

function showToast(message, type = 'info', title = '') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: '成功', error: '错误', warning: '警告', info: '提示' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title || titles[type]}</div>
            <div class="toast-message">${message}</div>
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
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-title">${title}</div>
                <div class="modal-message">${message}</div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); window.modalResolve(false)">取消</button>
                    <button class="btn btn-danger" onclick="this.closest('.modal').remove(); window.modalResolve(true)">确定</button>
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
    overlay.innerHTML = `<div class="spinner"></div><div class="loading-text">${text}</div>`;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

if (authToken) {
    showMainContent();
    loadTokens();
    loadConfig();
}

document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn.disabled) return;
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    btn.disabled = true;
    btn.classList.add('loading');
    const originalText = btn.textContent;
    btn.textContent = '登录中';
    
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
            showToast('登录成功', 'success');
            showMainContent();
            loadTokens();
            loadConfig();
        } else {
            showToast(data.message || '用户名或密码错误', 'error');
        }
    } catch (error) {
        showToast('登录失败: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = originalText;
    }
});

function showOAuthModal() {
    showToast('点击后请在新窗口完成授权', 'info');
    const modal = document.createElement('div');
    modal.className = 'modal form-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">🔐 OAuth授权登录</div>
            <div class="oauth-steps">
                <p><strong>📝 授权流程：</strong></p>
                <p>1️⃣ 点击下方按钮打开Google授权页面</p>
                <p>2️⃣ 完成授权后，复制浏览器地址栏的完整URL</p>
                <p>3️⃣ 粘贴URL到下方输入框并提交</p>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button type="button" onclick="openOAuthWindow()" class="btn btn-success" style="flex: 1;">🔐 打开授权页面</button>
                <button type="button" onclick="copyOAuthUrl()" class="btn btn-info" style="flex: 1;">📋 复制授权链接</button>
            </div>
            <input type="text" id="modalCallbackUrl" placeholder="粘贴完整的回调URL (http://localhost:xxxxx/oauth-callback?code=...)">
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-success" onclick="processOAuthCallbackModal()">✅ 提交</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function createTokenFormBody({
    title,
    showAccess = true,
    showRefresh = true,
    showExpires = true
} = {}) {
    const parts = [];
    if (showAccess) {
        parts.push('<input type="text" id="modalAccessToken" placeholder="Access Token (必填)">');
    }
    if (showRefresh) {
        parts.push('<input type="text" id="modalRefreshToken" placeholder="Refresh Token (必填)">');
    }
    if (showExpires) {
        parts.push('<input type="number" id="modalExpiresIn" placeholder="过期时间(秒)" value="3599">');
    }
    return `
        <div class="modal-content">
            <div class="modal-title">${title}</div>
            <div class="form-row">${parts.join('')}</div>
            <p style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 12px;">💡 过期时间默认3599秒(约1小时)</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-success" onclick="addTokenFromModal()">✅ 添加</button>
            </div>
        </div>
    `;
}

function showManualModal() {
    const modal = document.createElement('div');
    modal.className = 'modal form-modal';
    modal.innerHTML = createTokenFormBody({ title: '✏️ 手动填入Token' });
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function getOAuthUrl() {
    if (!oauthPort) oauthPort = Math.floor(Math.random() * 10000) + 50000;
    const redirectUri = `http://localhost:${oauthPort}/oauth-callback`;
    return `https://accounts.google.com/o/oauth2/v2/auth?` +
        `access_type=offline&client_id=${CLIENT_ID}&prompt=consent&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&` +
        `scope=${encodeURIComponent(SCOPES)}&state=${Date.now()}`;
}

function openOAuthWindow() {
    window.open(getOAuthUrl(), '_blank');
}

function copyOAuthUrl() {
    const url = getOAuthUrl();
    navigator.clipboard.writeText(url).then(() => {
        showToast('授权链接已复制', 'success');
    }).catch(() => {
        showToast('复制失败', 'error');
    });
}

async function processOAuthCallbackModal() {
    const modal = document.querySelector('.form-modal');
    const callbackUrl = document.getElementById('modalCallbackUrl').value.trim();
    if (!callbackUrl) {
        showToast('请输入回调URL', 'warning');
        return;
    }
    
    showLoading('正在处理授权...');
    
    try {
        const url = new URL(callbackUrl);
        const code = url.searchParams.get('code');
        const port = new URL(url.origin).port || (url.protocol === 'https:' ? 443 : 80);
        
        if (!code) {
            hideLoading();
            showToast('URL中未找到授权码', 'error');
            return;
        }
        
        const response = await authFetch('/admin/oauth/exchange', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ code, port })
        });
        
        const result = await response.json();
        if (result.success) {
            const account = result.data;
            const addResponse = await authFetch('/admin/tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(account)
            });
            
            const addResult = await addResponse.json();
            hideLoading();
            if (addResult.success) {
                modal.remove();
                showToast('Token添加成功', 'success');
                loadTokens();
            } else {
                showToast('添加失败: ' + addResult.message, 'error');
            }
        } else {
            hideLoading();
            showToast('交换失败: ' + result.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('处理失败: ' + error.message, 'error');
    }
}

async function addTokenFromModal() {
    const modal = document.querySelector('.form-modal');
    const accessToken = document.getElementById('modalAccessToken').value.trim();
    const refreshToken = document.getElementById('modalRefreshToken').value.trim();
    const expiresIn = parseInt(document.getElementById('modalExpiresIn').value);
    
    if (!accessToken || !refreshToken) {
        showToast('请填写完整的Token信息', 'warning');
        return;
    }
    
    showLoading('正在添加Token...');
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
            showToast('Token添加成功', 'success');
            loadTokens();
        } else {
            showToast(data.message || '添加失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('添加失败: ' + error.message, 'error');
    }
}

function showMainContent() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('tokensPage').classList.add('hidden');
    document.getElementById('settingsPage').classList.add('hidden');
    
    if (tab === 'tokens') {
        document.getElementById('tokensPage').classList.remove('hidden');
    } else if (tab === 'settings') {
        document.getElementById('settingsPage').classList.remove('hidden');
        loadConfig();
    }
}

function silentLogout() {
    localStorage.removeItem('authToken');
    authToken = null;
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
}

async function logout() {
    const confirmed = await showConfirm('确定要退出登录吗？', '退出确认');
    if (!confirmed) return;
    
    silentLogout();
    showToast('已退出登录', 'info');
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
            showToast('加载失败: ' + (data.message || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('加载Token失败: ' + error.message, 'error');
    }
}

function renderTokens(tokens) {
    // 缓存tokens用于额度弹窗
    cachedTokens = tokens;
    
    document.getElementById('totalTokens').textContent = tokens.length;
    document.getElementById('enabledTokens').textContent = tokens.filter(t => t.enable).length;
    document.getElementById('disabledTokens').textContent = tokens.filter(t => !t.enable).length;
    
    const tokenList = document.getElementById('tokenList');
    if (tokens.length === 0) {
        tokenList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">暂无Token</div>
                <div class="empty-state-hint">点击上方OAuth按钮添加Token</div>
            </div>
        `;
        return;
    }
    
    tokenList.innerHTML = tokens.map(token => {
        const expireTime = new Date(token.timestamp + token.expires_in * 1000);
        const isExpired = expireTime < new Date();
        const expireStr = expireTime.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
        const cardId = token.refresh_token.substring(0, 8);
        
        return `
        <div class="token-card ${!token.enable ? 'disabled' : ''} ${isExpired ? 'expired' : ''}">
            <div class="token-header">
                <span class="status ${token.enable ? 'enabled' : 'disabled'}">
                    ${token.enable ? '✅ 启用' : '❌ 禁用'}
                </span>
                <div class="token-header-right">
                    <button class="btn-icon" onclick="showTokenDetail('${token.refresh_token}')" title="编辑全部">✏️</button>
                    <span class="token-id">#${token.refresh_token.substring(0, 6)}</span>
                </div>
            </div>
            <div class="token-info">
                <div class="info-row">
                    <span class="info-label">🎫</span>
                    <span class="info-value sensitive-info" title="${token.access_token_suffix}">${token.access_token_suffix}</span>
                </div>
                <div class="info-row editable" onclick="editField(event, '${token.refresh_token}', 'projectId', '${(token.projectId || '').replace(/'/g, "\\'")}')" title="点击编辑">
                    <span class="info-label">📦</span>
                    <span class="info-value sensitive-info">${token.projectId || '点击设置'}</span>
                    <span class="info-edit-icon">✏️</span>
                </div>
                <div class="info-row editable" onclick="editField(event, '${token.refresh_token}', 'email', '${(token.email || '').replace(/'/g, "\\'")}')" title="点击编辑">
                    <span class="info-label">📧</span>
                    <span class="info-value sensitive-info">${token.email || '点击设置'}</span>
                    <span class="info-edit-icon">✏️</span>
                </div>
                <div class="info-row ${isExpired ? 'expired-text' : ''}">
                    <span class="info-label">⏰</span>
                    <span class="info-value">${expireStr}${isExpired ? ' (已过期)' : ''}</span>
                </div>
            </div>
            <!-- 内嵌额度显示 -->
            <div class="token-quota-inline" id="quota-inline-${cardId}">
                <div class="quota-inline-header" onclick="toggleQuotaExpand('${cardId}', '${token.refresh_token}')">
                    <span class="quota-inline-summary" id="quota-summary-${cardId}">📊 加载中...</span>
                    <span class="quota-inline-toggle" id="quota-toggle-${cardId}">▼</span>
                </div>
                <div class="quota-inline-detail hidden" id="quota-detail-${cardId}"></div>
            </div>
            <div class="token-actions">
                <button class="btn btn-info btn-xs" onclick="showQuotaModal('${token.refresh_token}')" title="查看额度">📊 详情</button>
                <button class="btn ${token.enable ? 'btn-warning' : 'btn-success'} btn-xs" onclick="toggleToken('${token.refresh_token}', ${!token.enable})" title="${token.enable ? '禁用' : '启用'}">
                    ${token.enable ? '⏸️ 禁用' : '▶️ 启用'}
                </button>
                <button class="btn btn-danger btn-xs" onclick="deleteToken('${token.refresh_token}')" title="删除">🗑️ 删除</button>
            </div>
        </div>
    `}).join('');
    
    // 自动加载所有token的额度摘要
    tokens.forEach(token => {
        loadTokenQuotaSummary(token.refresh_token);
    });
    
    // 应用敏感信息隐藏状态
    updateSensitiveInfoDisplay();
}

// 加载token额度摘要（只显示最低额度的模型）
async function loadTokenQuotaSummary(refreshToken) {
    const cardId = refreshToken.substring(0, 8);
    const summaryEl = document.getElementById(`quota-summary-${cardId}`);
    if (!summaryEl) return;
    
    // 先检查缓存
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
            // 缓存数据
            quotaCache.set(refreshToken, data.data);
            renderQuotaSummary(summaryEl, data.data);
        } else {
            const errMsg = data.message || '未知错误';
            summaryEl.innerHTML = `<span class="quota-summary-error">📊 ${errMsg}</span>`;
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('加载额度摘要失败:', error);
            summaryEl.innerHTML = `<span class="quota-summary-error">📊 加载失败</span>`;
        }
    }
}

// 渲染额度摘要
function renderQuotaSummary(summaryEl, quotaData) {
    const models = quotaData.models;
    const modelEntries = Object.entries(models);
    
    if (modelEntries.length === 0) {
        summaryEl.textContent = '📊 暂无额度';
        return;
    }
    
    // 找到额度最低的模型
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
    const shortName = minModel.replace('models/', '').replace('publishers/google/', '').split('/').pop();
    const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
    
    // 简洁的一行显示
    summaryEl.innerHTML = `
        <span class="quota-summary-icon">📊</span>
        <span class="quota-summary-model" title="${minModel}">${shortName}</span>
        <span class="quota-summary-bar"><span style="width:${percentage}%;background:${barColor}"></span></span>
        <span class="quota-summary-pct">${percentageText}</span>
    `;
}

// 展开/收起额度详情
async function toggleQuotaExpand(cardId, refreshToken) {
    const detailEl = document.getElementById(`quota-detail-${cardId}`);
    const toggleEl = document.getElementById(`quota-toggle-${cardId}`);
    if (!detailEl || !toggleEl) return;
    
    const isHidden = detailEl.classList.contains('hidden');
    
    if (isHidden) {
        // 展开
        detailEl.classList.remove('hidden');
        toggleEl.textContent = '▲';
        
        // 如果还没加载过详情，加载它
        if (!detailEl.dataset.loaded) {
            detailEl.innerHTML = '<div class="quota-loading-small">加载中...</div>';
            await loadQuotaDetail(cardId, refreshToken);
            detailEl.dataset.loaded = 'true';
        }
    } else {
        // 收起
        detailEl.classList.add('hidden');
        toggleEl.textContent = '▼';
    }
}

// 加载额度详情
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
                detailEl.innerHTML = '<div class="quota-empty-small">暂无额度信息</div>';
                return;
            }
            
            // 按模型类型分组
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
                    const shortName = modelId.replace('models/', '').replace('publishers/google/', '').split('/').pop();
                    // 紧凑的一行显示
                    groupHtml += `
                        <div class="quota-detail-row" title="${modelId} - 重置: ${quota.resetTime}">
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
            
            // 添加刷新按钮
            html += `<button class="btn btn-info btn-xs quota-refresh-btn" onclick="refreshInlineQuota('${cardId}', '${refreshToken}')">🔄 刷新额度</button>`;
            
            detailEl.innerHTML = html;
        } else {
            const errMsg = data.message || '未知错误';
            detailEl.innerHTML = `<div class="quota-error-small">加载失败: ${errMsg}</div>`;
        }
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            detailEl.innerHTML = `<div class="quota-error-small">网络错误</div>`;
        }
    }
}

// 刷新内嵌额度
async function refreshInlineQuota(cardId, refreshToken) {
    const detailEl = document.getElementById(`quota-detail-${cardId}`);
    const summaryEl = document.getElementById(`quota-summary-${cardId}`);
    
    if (detailEl) {
        detailEl.innerHTML = '<div class="quota-loading-small">刷新中...</div>';
    }
    if (summaryEl) {
        summaryEl.textContent = '📊 刷新中...';
    }
    
    // 清除缓存
    quotaCache.clear(refreshToken);
    
    // 强制刷新
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}/quotas?refresh=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success && data.data) {
            quotaCache.set(refreshToken, data.data);
        }
    } catch (e) {}
    
    // 重新加载摘要和详情
    await loadTokenQuotaSummary(refreshToken);
    await loadQuotaDetail(cardId, refreshToken);
}

// 内联编辑字段
function editField(event, refreshToken, field, currentValue) {
    event.stopPropagation();
    const row = event.currentTarget;
    const valueSpan = row.querySelector('.info-value');
    
    // 如果已经在编辑状态，不重复创建
    if (row.querySelector('input')) return;
    
    const fieldLabels = {
        projectId: 'Project ID',
        email: '邮箱'
    };
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = field === 'email' ? 'email' : 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';
    input.placeholder = `输入${fieldLabels[field]}`;
    
    // 保存原始内容
    const originalContent = valueSpan.textContent;
    valueSpan.style.display = 'none';
    row.insertBefore(input, valueSpan.nextSibling);
    input.focus();
    input.select();
    
    // 保存函数
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
                showToast('已保存', 'success');
                loadTokens();
            } else {
                showToast(data.message || '保存失败', 'error');
                cancel();
            }
        } catch (error) {
            showToast('保存失败', 'error');
            cancel();
        }
    };
    
    // 取消函数
    const cancel = () => {
        input.remove();
        valueSpan.style.display = '';
    };
    
    // 事件监听
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

// 显示Token详情编辑弹窗
function showTokenDetail(refreshToken) {
    const token = cachedTokens.find(t => t.refresh_token === refreshToken);
    if (!token) {
        showToast('Token不存在', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal form-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">📝 Token详情</div>
            <div class="form-group compact">
                <label>🎫 Access Token (只读)</label>
                <div class="token-display">${token.access_token || ''}</div>
            </div>
            <div class="form-group compact">
                <label>🔄 Refresh Token (只读)</label>
                <div class="token-display">${token.refresh_token}</div>
            </div>
            <div class="form-group compact">
                <label>📦 Project ID</label>
                <input type="text" id="editProjectId" value="${token.projectId || ''}" placeholder="项目ID">
            </div>
            <div class="form-group compact">
                <label>📧 邮箱</label>
                <input type="email" id="editEmail" value="${token.email || ''}" placeholder="账号邮箱">
            </div>
            <div class="form-group compact">
                <label>⏰ 过期时间</label>
                <input type="text" value="${new Date(token.timestamp + token.expires_in * 1000).toLocaleString('zh-CN')}" readonly style="background: var(--bg); cursor: not-allowed;">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-success" onclick="saveTokenDetail('${refreshToken}')">💾 保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// 保存Token详情
async function saveTokenDetail(refreshToken) {
    const projectId = document.getElementById('editProjectId').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    
    showLoading('保存中...');
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
            showToast('保存成功', 'success');
            loadTokens();
        } else {
            showToast(data.message || '保存失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('保存失败: ' + error.message, 'error');
    }
}

async function toggleToken(refreshToken, enable) {
    const action = enable ? '启用' : '禁用';
    const confirmed = await showConfirm(`确定要${action}这个Token吗？`, `${action}确认`);
    if (!confirmed) return;
    
    showLoading(`正在${action}...`);
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
            showToast(`已${action}`, 'success');
            loadTokens();
        } else {
            showToast(data.message || '操作失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('操作失败: ' + error.message, 'error');
    }
}

async function deleteToken(refreshToken) {
    const confirmed = await showConfirm('删除后无法恢复，确定删除？', '⚠️ 删除确认');
    if (!confirmed) return;
    
    showLoading('正在删除...');
    try {
        const response = await authFetch(`/admin/tokens/${encodeURIComponent(refreshToken)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        hideLoading();
        if (data.success) {
            showToast('已删除', 'success');
            loadTokens();
        } else {
            showToast(data.message || '删除失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('删除失败: ' + error.message, 'error');
    }
}

// 存储token数据用于额度弹窗显示邮箱
let cachedTokens = [];
// 当前选中的token（用于额度弹窗）
let currentQuotaToken = null;

// 额度数据缓存 - 避免频繁请求
const quotaCache = {
    data: {},  // { refreshToken: { data, timestamp } }
    ttl: 5 * 60 * 1000,  // 缓存5分钟
    
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
        this.data[refreshToken] = {
            data,
            timestamp: Date.now()
        };
    },
    
    clear(refreshToken) {
        if (refreshToken) {
            delete this.data[refreshToken];
        } else {
            this.data = {};
        }
    }
};

async function showQuotaModal(refreshToken) {
    currentQuotaToken = refreshToken;
    
    // 找到当前token的索引
    const activeIndex = cachedTokens.findIndex(t => t.refresh_token === refreshToken);
    
    // 生成邮箱标签 - 使用索引来确保只有一个active
    const emailTabs = cachedTokens.map((t, index) => {
        const email = t.email || '未知';
        const shortEmail = email.length > 20 ? email.substring(0, 17) + '...' : email;
        const isActive = index === activeIndex;
        return `<button type="button" class="quota-tab${isActive ? ' active' : ''}" data-index="${index}" onclick="switchQuotaAccountByIndex(${index})" title="${email}">${shortEmail}</button>`;
    }).join('');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'quotaModal';
    modal.innerHTML = `
        <div class="modal-content modal-xl">
            <div class="quota-modal-header">
                <div class="modal-title">📊 模型额度</div>
                <div class="quota-update-time" id="quotaUpdateTime"></div>
            </div>
            <div class="quota-tabs" id="quotaEmailList">
                ${emailTabs}
            </div>
            <div id="quotaContent" class="quota-container">
                <div class="quota-loading">加载中...</div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-info btn-sm" id="quotaRefreshBtn" onclick="refreshQuotaData()">🔄 刷新</button>
                <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal').remove()">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    await loadQuotaData(refreshToken);
    
    // 添加鼠标滚轮横向滚动支持
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

// 切换账号（通过索引）
async function switchQuotaAccountByIndex(index) {
    if (index < 0 || index >= cachedTokens.length) return;
    
    const token = cachedTokens[index];
    currentQuotaToken = token.refresh_token;
    
    // 更新标签的激活状态
    document.querySelectorAll('.quota-tab').forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // 加载新账号的额度
    await loadQuotaData(token.refresh_token);
}

// 保留旧函数以兼容
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
        refreshBtn.textContent = '⏳ 加载中...';
    }
    
    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
        const cached = quotaCache.get(refreshToken);
        if (cached) {
            renderQuotaModal(quotaContent, cached);
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 刷新';
            }
            return;
        }
    } else {
        // 强制刷新时清除缓存
        quotaCache.clear(refreshToken);
    }
    
    quotaContent.innerHTML = '<div class="quota-loading">加载中...</div>';
    
    try {
        const url = `/admin/tokens/${encodeURIComponent(refreshToken)}/quotas${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 缓存数据
            quotaCache.set(refreshToken, data.data);
            renderQuotaModal(quotaContent, data.data);
        } else {
            quotaContent.innerHTML = `<div class="quota-error">加载失败: ${data.message}</div>`;
        }
    } catch (error) {
        if (quotaContent) {
            quotaContent.innerHTML = `<div class="quota-error">加载失败: ${error.message}</div>`;
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 刷新';
        }
    }
}

async function refreshQuotaData() {
    if (currentQuotaToken) {
        await loadQuotaData(currentQuotaToken, true);
    }
}

// 渲染额度弹窗内容
function renderQuotaModal(quotaContent, quotaData) {
    const models = quotaData.models;
    
    // 更新时间显示
    const updateTimeEl = document.getElementById('quotaUpdateTime');
    if (updateTimeEl && quotaData.lastUpdated) {
        const lastUpdated = new Date(quotaData.lastUpdated).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        updateTimeEl.textContent = `更新于 ${lastUpdated}`;
    }
    
    if (Object.keys(models).length === 0) {
        quotaContent.innerHTML = '<div class="quota-empty">暂无额度信息</div>';
        return;
    }
    
    // 按模型类型分组
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
        let groupHtml = `<div class="quota-group-title">${title}</div><div class="quota-grid">`;
        items.forEach(({ modelId, quota }) => {
            const percentage = quota.remaining * 100;
            const percentageText = `${percentage.toFixed(2)}%`;
            const barColor = percentage > 50 ? '#10b981' : percentage > 20 ? '#f59e0b' : '#ef4444';
            const shortName = modelId.replace('models/', '').replace('publishers/google/', '');
            groupHtml += `
                <div class="quota-item">
                    <div class="quota-model-name" title="${modelId}">${shortName}</div>
                    <div class="quota-bar-container">
                        <div class="quota-bar" style="width: ${percentage}%; background: ${barColor};"></div>
                    </div>
                    <div class="quota-info-row">
                        <span class="quota-reset">重置: ${quota.resetTime}</span>
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
    html += renderGroup(grouped.other, '🔧 其他');
    
    quotaContent.innerHTML = html;
}

// 切换请求次数输入框的显示
function toggleRequestCountInput() {
    const strategy = document.getElementById('rotationStrategy').value;
    const requestCountGroup = document.getElementById('requestCountGroup');
    if (requestCountGroup) {
        requestCountGroup.style.display = strategy === 'request_count' ? 'block' : 'none';
    }
}

// 加载轮询策略状态
async function loadRotationStatus() {
    try {
        const response = await authFetch('/admin/rotation', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const { strategy, requestCount, currentIndex, tokenCounts } = data.data;
            const strategyNames = {
                'round_robin': '均衡负载',
                'quota_exhausted': '额度耗尽切换',
                'request_count': '自定义次数'
            };
            const statusEl = document.getElementById('currentRotationInfo');
            if (statusEl) {
                let statusText = `${strategyNames[strategy] || strategy}`;
                if (strategy === 'request_count') {
                    statusText += ` (每${requestCount}次)`;
                }
                statusText += ` | 当前索引: ${currentIndex}`;
                statusEl.textContent = statusText;
            }
        }
    } catch (error) {
        console.error('加载轮询状态失败:', error);
    }
}

async function loadConfig() {
    try {
        const response = await authFetch('/admin/config', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const form = document.getElementById('configForm');
            const { env, json } = data.data;
            
            // 更新服务器信息显示
            const serverInfo = document.getElementById('serverInfo');
            if (serverInfo && json.server) {
                serverInfo.textContent = `${json.server.host || '0.0.0.0'}:${json.server.port || 8045}`;
            }
            
            // 加载 .env 配置
            Object.entries(env).forEach(([key, value]) => {
                const input = form.elements[key];
                if (input) input.value = value || '';
            });
            
            // 加载 config.json 配置
            if (json.server) {
                if (form.elements['PORT']) form.elements['PORT'].value = json.server.port || '';
                if (form.elements['HOST']) form.elements['HOST'].value = json.server.host || '';
                if (form.elements['MAX_REQUEST_SIZE']) form.elements['MAX_REQUEST_SIZE'].value = json.server.maxRequestSize || '';
                if (form.elements['HEARTBEAT_INTERVAL']) form.elements['HEARTBEAT_INTERVAL'].value = json.server.heartbeatInterval || '';
                if (form.elements['MEMORY_THRESHOLD']) form.elements['MEMORY_THRESHOLD'].value = json.server.memoryThreshold || '';
            }
            if (json.defaults) {
                if (form.elements['DEFAULT_TEMPERATURE']) form.elements['DEFAULT_TEMPERATURE'].value = json.defaults.temperature ?? '';
                if (form.elements['DEFAULT_TOP_P']) form.elements['DEFAULT_TOP_P'].value = json.defaults.topP ?? '';
                if (form.elements['DEFAULT_TOP_K']) form.elements['DEFAULT_TOP_K'].value = json.defaults.topK ?? '';
                if (form.elements['DEFAULT_MAX_TOKENS']) form.elements['DEFAULT_MAX_TOKENS'].value = json.defaults.maxTokens ?? '';
                if (form.elements['DEFAULT_THINKING_BUDGET']) form.elements['DEFAULT_THINKING_BUDGET'].value = json.defaults.thinkingBudget ?? '';
            }
            if (json.other) {
                if (form.elements['TIMEOUT']) form.elements['TIMEOUT'].value = json.other.timeout ?? '';
                if (form.elements['RETRY_TIMES']) form.elements['RETRY_TIMES'].value = json.other.retryTimes ?? '';
                if (form.elements['SKIP_PROJECT_ID_FETCH']) form.elements['SKIP_PROJECT_ID_FETCH'].value = json.other.skipProjectIdFetch ? 'true' : 'false';
            }
            // 加载轮询策略配置
            if (json.rotation) {
                if (form.elements['ROTATION_STRATEGY']) {
                    form.elements['ROTATION_STRATEGY'].value = json.rotation.strategy || 'round_robin';
                }
                if (form.elements['ROTATION_REQUEST_COUNT']) {
                    form.elements['ROTATION_REQUEST_COUNT'].value = json.rotation.requestCount || 10;
                }
                toggleRequestCountInput();
            }
            
            // 加载轮询状态
            loadRotationStatus();
        }
    } catch (error) {
        showToast('加载配置失败: ' + error.message, 'error');
    }
}

document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const allConfig = Object.fromEntries(formData);
    
    // 分离敏感和非敏感配置
    const sensitiveKeys = ['API_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET', 'PROXY', 'SYSTEM_INSTRUCTION', 'IMAGE_BASE_URL'];
    const envConfig = {};
    const jsonConfig = {
        server: {},
        api: {},
        defaults: {},
        other: {},
        rotation: {}
    };
    
    Object.entries(allConfig).forEach(([key, value]) => {
        if (sensitiveKeys.includes(key)) {
            envConfig[key] = value;
        } else {
            // 映射到 config.json 结构
            if (key === 'PORT') jsonConfig.server.port = parseInt(value) || undefined;
            else if (key === 'HOST') jsonConfig.server.host = value || undefined;
            else if (key === 'MAX_REQUEST_SIZE') jsonConfig.server.maxRequestSize = value || undefined;
            else if (key === 'HEARTBEAT_INTERVAL') jsonConfig.server.heartbeatInterval = parseInt(value) || undefined;
            else if (key === 'MEMORY_THRESHOLD') jsonConfig.server.memoryThreshold = parseInt(value) || undefined;
            else if (key === 'DEFAULT_TEMPERATURE') jsonConfig.defaults.temperature = parseFloat(value) || undefined;
            else if (key === 'DEFAULT_TOP_P') jsonConfig.defaults.topP = parseFloat(value) || undefined;
            else if (key === 'DEFAULT_TOP_K') jsonConfig.defaults.topK = parseInt(value) || undefined;
            else if (key === 'DEFAULT_MAX_TOKENS') jsonConfig.defaults.maxTokens = parseInt(value) || undefined;
            else if (key === 'DEFAULT_THINKING_BUDGET') {
                const num = parseInt(value);
                jsonConfig.defaults.thinkingBudget = Number.isNaN(num) ? undefined : num;
            }
            else if (key === 'TIMEOUT') jsonConfig.other.timeout = parseInt(value) || undefined;
            else if (key === 'RETRY_TIMES') {
                const num = parseInt(value);
                jsonConfig.other.retryTimes = Number.isNaN(num) ? undefined : num;
            }
            else if (key === 'SKIP_PROJECT_ID_FETCH') jsonConfig.other.skipProjectIdFetch = value === 'true';
            else if (key === 'ROTATION_STRATEGY') jsonConfig.rotation.strategy = value || undefined;
            else if (key === 'ROTATION_REQUEST_COUNT') jsonConfig.rotation.requestCount = parseInt(value) || undefined;
            else envConfig[key] = value;
        }
    });
    
    // 清理undefined值
    Object.keys(jsonConfig).forEach(section => {
        Object.keys(jsonConfig[section]).forEach(key => {
            if (jsonConfig[section][key] === undefined) {
                delete jsonConfig[section][key];
            }
        });
        if (Object.keys(jsonConfig[section]).length === 0) {
            delete jsonConfig[section];
        }
    });
    
    showLoading('正在保存配置...');
    try {
        // 先保存通用配置
        const response = await authFetch('/admin/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ env: envConfig, json: jsonConfig })
        });
        
        const data = await response.json();
        
        // 如果有轮询配置，单独更新轮询策略（触发热更新）
        if (jsonConfig.rotation && Object.keys(jsonConfig.rotation).length > 0) {
            await authFetch('/admin/rotation', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(jsonConfig.rotation)
            });
        }
        
        hideLoading();
        if (data.success) {
            showToast('配置已保存', 'success');
            loadConfig(); // 重新加载以更新显示
        } else {
            showToast(data.message || '保存失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('保存失败: ' + error.message, 'error');
    }
});
