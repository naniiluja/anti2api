import { useState } from 'react';
import Modal from '../../components/common/Modal';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import tokenService from './tokenService';
import axiosClient from '../../api/axiosClient';

const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs'
].join(' ');

const OAuthModal = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [callbackUrl, setCallbackUrl] = useState('');
    const [oauthPort] = useState(() => Math.floor(Math.random() * 10000) + 50000);

    const getOAuthUrl = () => {
        const redirectUri = `http://localhost:${oauthPort}/oauth-callback`;
        return `https://accounts.google.com/o/oauth2/v2/auth?` +
            `access_type=offline&client_id=${CLIENT_ID}&prompt=consent&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&` +
            `scope=${encodeURIComponent(SCOPES)}&state=${Date.now()}`;
    };

    const handleOpenAuth = () => {
        window.open(getOAuthUrl(), '_blank');
        showToast(t('messages.clickThenAuth'), 'info');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(getOAuthUrl())
            .then(() => showToast(t('messages.authLinkCopied'), 'success'))
            .catch(() => showToast(t('messages.copyFailed'), 'error'));
    };

    const handleSubmit = async () => {
        if (!callbackUrl) {
            showToast(t('messages.pleaseInputUrl'), 'warning');
            return;
        }

        setLoading(true);
        try {
            const url = new URL(callbackUrl);
            const code = url.searchParams.get('code');
            const port = new URL(url.origin).port || (url.protocol === 'https:' ? 443 : 80);

            if (!code) {
                showToast(t('messages.noAuthCode'), 'error');
                setLoading(false);
                return;
            }

            // 1. Exchange Code
            const exchangeRes = await axiosClient.post('/admin/oauth/exchange', { code, port });

            if (exchangeRes.success) {
                const account = exchangeRes.data;
                // 2. Add Token
                const addRes = await tokenService.add(account);

                if (addRes.success) {
                    showToast(
                        exchangeRes.fallbackMode ? t('messages.tokenAddedWithFallback') : t('messages.tokenAdded'),
                        exchangeRes.fallbackMode ? 'warning' : 'success'
                    );
                    onSuccess();
                    onClose();
                } else {
                    showToast(t('messages.addFailed') + ': ' + addRes.message, 'error');
                }
            } else {
                showToast(t('messages.exchangeFailed') + ': ' + exchangeRes.message, 'error');
            }

        } catch (err) {
            showToast(t('messages.processFailed') + ': ' + (err.message || 'Error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`🔐 ${t('modals.oauthTitle')}`}
            actions={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>{t('buttons.cancel')}</button>
                    <button className="btn btn-success" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Processing...' : `✅ ${t('modals.submit')}`}
                    </button>
                </>
            }
        >
            <div className="oauth-steps" style={{ fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.6' }}>
                <p><strong>📝 {t('modals.oauthSteps')}</strong></p>
                <p>1️⃣ {t('modals.oauthStep1')}</p>
                <p>2️⃣ {t('modals.oauthStep2')}</p>
                <p>3️⃣ {t('modals.oauthStep3')}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button type="button" onClick={handleOpenAuth} className="btn btn-success" style={{ flex: 1 }}>
                    🔐 {t('modals.openAuthPage')}
                </button>
                <button type="button" onClick={handleCopyLink} className="btn btn-info" style={{ flex: 1 }}>
                    📋 {t('modals.copyAuthLink')}
                </button>
            </div>
            <input
                type="text"
                placeholder={t('modals.pasteCallbackUrl')}
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                style={{ width: '100%' }}
            />
        </Modal>
    );
};

export default OAuthModal;
