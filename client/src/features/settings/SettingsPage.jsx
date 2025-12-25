import { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const SettingsPage = () => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(null);
    const [rotationStatus, setRotationStatus] = useState(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [configRes, rotationRes] = await Promise.all([
                axiosClient.get('/admin/config'),
                axiosClient.get('/admin/rotation')
            ]);

            if (configRes.success) {
                setConfig(parseConfig(configRes.data));
            }
            if (rotationRes.success) {
                setRotationStatus(rotationRes.data);
            }
        } catch (err) {
            showToast(t('settings.loadConfigFailed') + ': ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const parseConfig = (data) => {
        const { env, json } = data;
        return {
            env: env || {},
            server: json.server || {},
            api: json.api || {},
            defaults: json.defaults || {},
            other: json.other || {},
            rotation: json.rotation || { strategy: 'round_robin', requestCount: 10 }
        };
    };

    const handleChange = (section, key, value) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const envConfig = { ...config.env };
            const jsonConfig = {
                server: config.server,
                api: config.api,
                defaults: config.defaults,
                other: config.other,
                rotation: config.rotation
            };

            const configRes = await axiosClient.put('/admin/config', { env: envConfig, json: jsonConfig });
            const rotationRes = await axiosClient.put('/admin/rotation', config.rotation);

            if (configRes.success && rotationRes.success) {
                showToast(t('settings.configSaved'), 'success');
                loadConfig();
            } else {
                showToast(t('messages.saveFailed'), 'error');
            }
        } catch (err) {
            showToast(t('messages.saveFailed') + ': ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingSpinner text={t('settings.loadingConfig')} />;
    if (!config) return <div>Error loading config</div>;

    return (
        <div id="settingsPage">
            {saving && <LoadingSpinner text={t('settings.savingConfig')} />}

            <div className="config-section" style={{ marginBottom: '1rem' }}>
                {rotationStatus && (
                    <div id="currentRotationInfo" className="status-info">
                        {rotationStatus.strategy === 'request_count'
                            ? `${t('settings.requestCount')} (${t('settings.perRequests', { count: rotationStatus.requestCount })})`
                            : rotationStatus.strategy === 'quota_exhausted'
                                ? t('settings.quotaExhausted')
                                : t('settings.roundRobin')}
                        {` | ${t('settings.currentIndex')}: ${rotationStatus.currentIndex}`}
                    </div>
                )}
            </div>

            <form id="configForm" onSubmit={handleSubmit}>
                {/* Sensitive Settings */}
                <div className="config-section">
                    <h4>{t('settings.sensitive') || 'Sensitive Settings'}</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>API Key</label>
                            <input
                                type="password"
                                value={config.env.API_KEY || ''}
                                onChange={(e) => handleChange('env', 'API_KEY', e.target.value)}
                                placeholder="Optional API Key"
                            />
                        </div>
                        <div className="form-group">
                            <label>Proxy</label>
                            <input
                                type="text"
                                value={config.env.PROXY || ''}
                                onChange={(e) => handleChange('env', 'PROXY', e.target.value)}
                                placeholder="http://host:port"
                            />
                        </div>
                        <div className="form-group">
                            <label>Image Base URL</label>
                            <input
                                type="text"
                                value={config.env.IMAGE_BASE_URL || ''}
                                onChange={(e) => handleChange('env', 'IMAGE_BASE_URL', e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>System Instruction</label>
                        <textarea
                            rows={4}
                            value={config.env.SYSTEM_INSTRUCTION || ''}
                            onChange={(e) => handleChange('env', 'SYSTEM_INSTRUCTION', e.target.value)}
                            placeholder="Default system prompt for all requests..."
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>

                {/* Server Settings */}
                <div className="config-section">
                    <h4>{t('settings.server')}</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Port</label>
                            <input
                                type="number"
                                value={config.server.port || ''}
                                onChange={(e) => handleChange('server', 'port', parseInt(e.target.value))}
                                placeholder="8045"
                            />
                        </div>
                        <div className="form-group">
                            <label>Host</label>
                            <input
                                type="text"
                                value={config.server.host || ''}
                                onChange={(e) => handleChange('server', 'host', e.target.value)}
                                placeholder="0.0.0.0"
                            />
                        </div>
                        <div className="form-group">
                            <label>Max Request Size</label>
                            <input
                                type="text"
                                value={config.server.maxRequestSize || ''}
                                onChange={(e) => handleChange('server', 'maxRequestSize', e.target.value)}
                                placeholder="50mb"
                            />
                        </div>
                        <div className="form-group">
                            <label>Heartbeat Interval (ms)</label>
                            <input
                                type="number"
                                value={config.server.heartbeatInterval || ''}
                                onChange={(e) => handleChange('server', 'heartbeatInterval', parseInt(e.target.value))}
                                placeholder="30000"
                            />
                        </div>
                        <div className="form-group">
                            <label>Memory Threshold (MB)</label>
                            <input
                                type="number"
                                value={config.server.memoryThreshold || ''}
                                onChange={(e) => handleChange('server', 'memoryThreshold', parseInt(e.target.value))}
                                placeholder="50"
                            />
                        </div>
                        <div className="form-group">
                            <label>Timeout (ms)</label>
                            <input
                                type="number"
                                value={config.other.timeout || ''}
                                onChange={(e) => handleChange('other', 'timeout', parseInt(e.target.value))}
                                placeholder="120000"
                            />
                        </div>
                        <div className="form-group">
                            <label>Retry Times</label>
                            <input
                                type="number"
                                value={config.other.retryTimes ?? ''}
                                onChange={(e) => handleChange('other', 'retryTimes', parseInt(e.target.value))}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* API Defaults */}
                <div className="config-section">
                    <h4>{t('settings.apiDefaults')}</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Temperature</label>
                            <input
                                type="number"
                                step="0.1"
                                value={config.defaults.temperature ?? ''}
                                onChange={(e) => handleChange('defaults', 'temperature', parseFloat(e.target.value))}
                                placeholder="1.0"
                            />
                        </div>
                        <div className="form-group">
                            <label>Top P</label>
                            <input
                                type="number"
                                step="0.1"
                                value={config.defaults.topP ?? ''}
                                onChange={(e) => handleChange('defaults', 'topP', parseFloat(e.target.value))}
                                placeholder="0.95"
                            />
                        </div>
                        <div className="form-group">
                            <label>Top K</label>
                            <input
                                type="number"
                                value={config.defaults.topK ?? ''}
                                onChange={(e) => handleChange('defaults', 'topK', parseInt(e.target.value))}
                                placeholder="40"
                            />
                        </div>
                        <div className="form-group">
                            <label>Max Output Tokens</label>
                            <input
                                type="number"
                                value={config.defaults.maxTokens ?? ''}
                                onChange={(e) => handleChange('defaults', 'maxTokens', parseInt(e.target.value))}
                                placeholder="8192"
                            />
                        </div>
                        <div className="form-group">
                            <label>Thinking Budget</label>
                            <input
                                type="number"
                                value={config.defaults.thinkingBudget ?? ''}
                                onChange={(e) => handleChange('defaults', 'thinkingBudget', parseInt(e.target.value))}
                                placeholder="10240"
                            />
                        </div>
                    </div>
                </div>

                {/* Rotation Strategy */}
                <div className="config-section">
                    <h4>{t('settings.rotation')}</h4>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>{t('settings.strategy')}</label>
                            <select
                                value={config.rotation.strategy || 'round_robin'}
                                onChange={(e) => handleChange('rotation', 'strategy', e.target.value)}
                            >
                                <option value="round_robin">{t('settings.roundRobin')}</option>
                                <option value="quota_exhausted">{t('settings.quotaExhausted')}</option>
                                <option value="request_count">{t('settings.requestCount')}</option>
                            </select>
                        </div>
                        {config.rotation.strategy === 'request_count' && (
                            <div className="form-group">
                                <label>{t('settings.requestCount')}</label>
                                <input
                                    type="number"
                                    value={config.rotation.requestCount || 10}
                                    onChange={(e) => handleChange('rotation', 'requestCount', parseInt(e.target.value))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Other Options */}
                <div className="config-section">
                    <h4>{t('settings.other')}</h4>
                    <div className="checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={config.other.skipProjectIdFetch || false}
                                onChange={(e) => handleChange('other', 'skipProjectIdFetch', e.target.checked)}
                            />
                            Skip Project ID Fetch
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={config.other.useNativeAxios !== false}
                                onChange={(e) => handleChange('other', 'useNativeAxios', e.target.checked)}
                            />
                            Use Native Axios
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={config.other.useContextSystemPrompt || false}
                                onChange={(e) => handleChange('other', 'useContextSystemPrompt', e.target.checked)}
                            />
                            Use Context System Prompt
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={config.other.passSignatureToClient || false}
                                onChange={(e) => handleChange('other', 'passSignatureToClient', e.target.checked)}
                            />
                            Pass Signature To Client
                        </label>
                    </div>
                </div>

                <div className="fixed-footer">
                    <button type="submit" className="btn btn-save" disabled={saving}>
                        {t('buttons.save')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsPage;
