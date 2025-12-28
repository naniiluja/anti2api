import { useEffect, useState, useMemo } from 'react';
import tokenService from './tokenService';
import TokenCard from './TokenCard';
import AddTokenModal from './AddTokenModal';
import OAuthModal from './OAuthModal';
import ChromaGrid from '../../components/common/ChromaGrid';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const TokensPage = () => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const { isAuthenticated } = useAuth();
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState(localStorage.getItem('tokenFilter') || 'all');
    const [showSensitive, setShowSensitive] = useState(localStorage.getItem('sensitiveInfoHidden') === 'false');

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            loadTokens();
        }
    }, [isAuthenticated]);

    const loadTokens = async () => {
        setLoading(true);
        try {
            const res = await tokenService.getAll();
            if (res.success) {
                setTokens(res.data);
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(t('messages.loadTokensFailed') + ': ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        localStorage.setItem('tokenFilter', newFilter);
    };

    const toggleSensitive = () => {
        const newValue = !showSensitive;
        setShowSensitive(newValue);
        localStorage.setItem('sensitiveInfoHidden', (!newValue).toString());
    };

    const filteredTokens = useMemo(() => {
        if (filter === 'enabled') return tokens.filter(t => t.enable);
        if (filter === 'disabled') return tokens.filter(t => !t.enable);
        return tokens;
    }, [tokens, filter]);

    const stats = useMemo(() => ({
        total: tokens.length,
        enabled: tokens.filter(t => t.enable).length,
        disabled: tokens.filter(t => !t.enable).length
    }), [tokens]);

    return (
        <div id="tokensPage">
            <div className="top-bar">
                <div className="stats-inline">
                    <div className={`stat-item clickable ${filter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>
                        <span className="stat-num">{stats.total}</span>
                        <span className="stat-text">{t('stats.total')}</span>
                    </div>
                    <div className={`stat-item success clickable ${filter === 'enabled' ? 'active' : ''}`} onClick={() => handleFilterChange('enabled')}>
                        <span className="stat-num">{stats.enabled}</span>
                        <span className="stat-text">{t('stats.enabled')}</span>
                    </div>
                    <div className={`stat-item danger clickable ${filter === 'disabled' ? 'active' : ''}`} onClick={() => handleFilterChange('disabled')}>
                        <span className="stat-num">{stats.disabled}</span>
                        <span className="stat-text">{t('stats.disabled')}</span>
                    </div>
                </div>
                <div className="action-btns">
                    <button className="btn btn-success btn-sm" onClick={() => setIsOAuthModalOpen(true)}>{t('buttons.oauth')}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsAddModalOpen(true)}>{t('buttons.manual')}</button>
                    <button className="btn btn-warning btn-sm" onClick={loadTokens}>{t('buttons.refresh')}</button>
                    <button className={`btn btn-sm ${showSensitive ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleSensitive}>
                        {showSensitive ? t('buttons.show') : t('buttons.hide')}
                    </button>
                </div>
            </div>

            <ChromaGrid radius={250} damping={0.4} fadeOut={0.5}>
                {loading && tokens.length === 0 ? (
                    <div className="empty-state"><div className="spinner"></div></div>
                ) : filteredTokens.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-text">{t('tokens.noTokens')}</div>
                    </div>
                ) : (
                    filteredTokens.map((token, index) => (
                        <TokenCard
                            key={token.refresh_token}
                            token={token}
                            index={index}
                            onUpdate={loadTokens}
                            onDelete={loadTokens}
                            showSensitive={showSensitive}
                        />
                    ))
                )}
            </ChromaGrid>

            <AddTokenModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={loadTokens}
            />

            <OAuthModal
                isOpen={isOAuthModalOpen}
                onClose={() => setIsOAuthModalOpen(false)}
                onSuccess={loadTokens}
            />
        </div>
    );
};

export default TokensPage;

