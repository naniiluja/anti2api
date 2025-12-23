// Config Management: load, save

function toggleRequestCountInput() {
    const strategy = document.getElementById('rotationStrategy').value;
    const requestCountGroup = document.getElementById('requestCountGroup');
    if (requestCountGroup) {
        requestCountGroup.style.display = strategy === 'request_count' ? 'block' : 'none';
    }
}

async function loadRotationStatus() {
    try {
        const response = await authFetch('/admin/rotation', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const { strategy, requestCount, currentIndex } = data.data;
            const strategyNames = {
                'round_robin': t('settings.roundRobin'),
                'quota_exhausted': t('settings.quotaExhausted'),
                'request_count': t('settings.requestCount')
            };
            const statusEl = document.getElementById('currentRotationInfo');
            if (statusEl) {
                let statusText = `${strategyNames[strategy] || strategy}`;
                if (strategy === 'request_count') {
                    statusText += ` (${t('settings.perRequests', {count: requestCount})})`;
                }
                statusText += ` | ${t('settings.currentIndex')}: ${currentIndex}`;
                statusEl.textContent = statusText;
            }
        }
    } catch (error) {
        console.error('loadRotationStatus failed:', error);
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
            
            Object.entries(env).forEach(([key, value]) => {
                const input = form.elements[key];
                if (input) input.value = value || '';
            });
            
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
                if (form.elements['SKIP_PROJECT_ID_FETCH']) form.elements['SKIP_PROJECT_ID_FETCH'].checked = json.other.skipProjectIdFetch || false;
                if (form.elements['USE_NATIVE_AXIOS']) form.elements['USE_NATIVE_AXIOS'].checked = json.other.useNativeAxios !== false;
                if (form.elements['USE_CONTEXT_SYSTEM_PROMPT']) form.elements['USE_CONTEXT_SYSTEM_PROMPT'].checked = json.other.useContextSystemPrompt || false;
                if (form.elements['PASS_SIGNATURE_TO_CLIENT']) form.elements['PASS_SIGNATURE_TO_CLIENT'].checked = json.other.passSignatureToClient || false;
            }
            if (json.rotation) {
                if (form.elements['ROTATION_STRATEGY']) {
                    form.elements['ROTATION_STRATEGY'].value = json.rotation.strategy || 'round_robin';
                }
                if (form.elements['ROTATION_REQUEST_COUNT']) {
                    form.elements['ROTATION_REQUEST_COUNT'].value = json.rotation.requestCount || 10;
                }
                toggleRequestCountInput();
            }
            
            loadRotationStatus();
        }
    } catch (error) {
        showToast(t('settings.loadConfigFailed') + ': ' + error.message, 'error');
    }
}

async function saveConfig(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const allConfig = Object.fromEntries(formData);
    
    const sensitiveKeys = ['API_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET', 'PROXY', 'SYSTEM_INSTRUCTION', 'IMAGE_BASE_URL'];
    const envConfig = {};
    const jsonConfig = {
        server: {},
        api: {},
        defaults: {},
        other: {},
        rotation: {}
    };
    
    // 处理checkbox：未选中的checkbox不会出现在FormData中
    jsonConfig.other.skipProjectIdFetch = form.elements['SKIP_PROJECT_ID_FETCH']?.checked || false;
    jsonConfig.other.useNativeAxios = form.elements['USE_NATIVE_AXIOS']?.checked || false;
    jsonConfig.other.useContextSystemPrompt = form.elements['USE_CONTEXT_SYSTEM_PROMPT']?.checked || false;
    jsonConfig.other.passSignatureToClient = form.elements['PASS_SIGNATURE_TO_CLIENT']?.checked || false;
    
    Object.entries(allConfig).forEach(([key, value]) => {
        if (sensitiveKeys.includes(key)) {
            envConfig[key] = value;
        } else {
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
            else if (key === 'SKIP_PROJECT_ID_FETCH' || key === 'USE_NATIVE_AXIOS' || key === 'USE_CONTEXT_SYSTEM_PROMPT' || key === 'PASS_SIGNATURE_TO_CLIENT') {
                // 跳过，已在上面处理
            }
            else if (key === 'ROTATION_STRATEGY') jsonConfig.rotation.strategy = value || undefined;
            else if (key === 'ROTATION_REQUEST_COUNT') jsonConfig.rotation.requestCount = parseInt(value) || undefined;
            else envConfig[key] = value;
        }
    });
    
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
    
    showLoading(t('settings.savingConfig'));
    try {
        const response = await authFetch('/admin/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ env: envConfig, json: jsonConfig })
        });
        
        const data = await response.json();
        
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
            showToast(t('settings.configSaved'), 'success');
            loadConfig();
        } else {
            showToast(data.message || t('messages.saveFailed'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast(t('messages.saveFailed') + ': ' + error.message, 'error');
    }
}
