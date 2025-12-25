import { useState, useEffect } from 'react';
import { VscClose, VscSave } from 'react-icons/vsc';
import { useI18n } from '../../context/I18nContext';

const ParameterModal = ({ isOpen, onClose, params, onSave }) => {
    const { t } = useI18n();
    const [localParams, setLocalParams] = useState(params);

    useEffect(() => {
        setLocalParams(params);
    }, [params, isOpen]);

    if (!isOpen) return null;

    const handleChange = (key, value) => {
        setLocalParams(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        onSave(localParams);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content parameter-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('playground.parameters') || 'Parameters'}</h3>
                    <button className="btn-icon" onClick={onClose}>
                        <VscClose size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Temperature */}
                    <div className="param-group">
                        <label>
                            <span>Temperature</span>
                            <span className="param-value">{localParams.temperature}</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localParams.temperature}
                            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                        />
                        <p className="param-hint">{t('playground.tempHint') || 'Higher values = more creative'}</p>
                    </div>

                    {/* Max Tokens */}
                    <div className="param-group">
                        <label>
                            <span>Max Tokens</span>
                            <span className="param-value">{localParams.max_tokens}</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="32768"
                            value={localParams.max_tokens}
                            onChange={(e) => handleChange('max_tokens', parseInt(e.target.value) || 4096)}
                        />
                    </div>

                    {/* Top P */}
                    <div className="param-group">
                        <label>
                            <span>Top P</span>
                            <span className="param-value">{localParams.top_p}</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localParams.top_p}
                            onChange={(e) => handleChange('top_p', parseFloat(e.target.value))}
                        />
                    </div>

                    {/* Reasoning Effort */}
                    <div className="param-group">
                        <label>
                            <span>Reasoning Effort</span>
                        </label>
                        <select
                            value={localParams.reasoning_effort}
                            onChange={(e) => handleChange('reasoning_effort', e.target.value)}
                        >
                            <option value="none">None</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                        <p className="param-hint">{t('playground.reasoningHint') || 'Enable chain-of-thought reasoning'}</p>
                    </div>

                    {/* Prompt Caching */}
                    <div className="param-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={localParams.prompt_caching || false}
                                onChange={(e) => handleChange('prompt_caching', e.target.checked)}
                            />
                            <span>{t('playground.promptCaching') || 'Prompt Caching'}</span>
                        </label>
                        <p className="param-hint">{t('playground.promptCachingHint') || 'Cache conversation context for faster responses (Claude models)'}</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        {t('common.cancel') || 'Cancel'}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <VscSave size={14} />
                        {t('common.save') || 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParameterModal;
