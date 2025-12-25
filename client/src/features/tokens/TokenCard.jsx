import { useState } from 'react';
import { VscEdit, VscRefresh, VscTrash, VscInfo, VscDebugStart, VscDebugPause } from 'react-icons/vsc';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import QuotaDisplay from './QuotaDisplay';
import InlineEdit from './InlineEdit';
import EditTokenModal from './EditTokenModal';
import tokenService from './tokenService';

const TokenCard = ({ token, index, onUpdate, onDelete, showSensitive }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const [isQuotaExpanded, setIsQuotaExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const isExpired = new Date(token.timestamp + token.expires_in * 1000) < new Date();
    const expireTime = new Date(token.timestamp + token.expires_in * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            const res = await tokenService.refresh(token.refresh_token);
            if (res.success) {
                showToast(t('messages.tokenRefreshed'), 'success');
                onUpdate();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleToggleEnable = async () => {
        const action = !token.enable ? 'enable' : 'disable';
        const ok = await confirm(
            t(action === 'enable' ? 'modals.enableConfirm' : 'modals.disableConfirm'),
            t('modals.confirmOperation')
        );
        if (!ok) return;

        try {
            await tokenService.update(token.refresh_token, { enable: !token.enable });
            showToast(t(action === 'enable' ? 'messages.enabled' : 'messages.disabled'), 'success');
            onUpdate();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async () => {
        const ok = await confirm(t('modals.deleteConfirm'), t('modals.confirmOperation'));
        if (!ok) return;

        try {
            await tokenService.delete(token.refresh_token);
            showToast(t('messages.deleted'), 'success');
            onDelete();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleInlineUpdate = async (field, value) => {
        try {
            const res = await tokenService.update(token.refresh_token, { [field]: value });
            if (res.success) {
                showToast(t('messages.saveSuccess'), 'success');
                onUpdate();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    return (
        <>
            <div className={`token-card ${!token.enable ? 'disabled' : ''} ${isExpired ? 'expired' : ''} ${isRefreshing ? 'refreshing' : ''}`}>
                <div className="token-header">
                    <span className={`status ${token.enable ? 'enabled' : 'disabled'}`}>
                        {token.enable ? t('tokens.enabled') : t('tokens.disabled')}
                    </span>
                    <div className="token-header-right">
                        <button
                            className="btn-icon"
                            title={t('tokens.editAll')}
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <VscEdit size={14} />
                        </button>
                        <span className="token-id">#{index + 1}</span>
                    </div>
                </div>

                <div className="token-info">
                    <div className="info-row sensitive-row" style={{ display: showSensitive ? 'flex' : 'none' }}>
                        <span className="info-label">Token</span>
                        <span className="info-value sensitive-info" title={token.access_token_suffix}>{token.access_token_suffix}</span>
                    </div>

                    <div style={{ display: showSensitive ? 'block' : 'none' }}>
                        <InlineEdit
                            label="Project"
                            value={token.projectId}
                            onSave={(val) => handleInlineUpdate('projectId', val)}
                            placeholder="Project ID"
                        />
                        <InlineEdit
                            label="Email"
                            value={token.email}
                            onSave={(val) => handleInlineUpdate('email', val)}
                            type="email"
                            placeholder="Email"
                        />
                    </div>

                    <div className={`info-row ${isExpired ? 'expired-text' : ''}`}>
                        <span className="info-label">Expires</span>
                        <span className="info-value">
                            {isRefreshing ? 'Refreshing...' : expireTime}
                            {isExpired && !isRefreshing && ' (Expired)'}
                        </span>
                        <button className="btn-icon" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
                            <VscRefresh size={14} className={isRefreshing ? 'spinning' : ''} />
                        </button>
                    </div>
                </div>

                <QuotaDisplay
                    refreshToken={token.refresh_token}
                    isExpanded={isQuotaExpanded}
                    onExpandToggle={() => setIsQuotaExpanded(!isQuotaExpanded)}
                />

                <div className="token-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsQuotaExpanded(true)}>
                        <VscInfo size={14} />
                        {t('buttons.details')}
                    </button>
                    <button className={`btn ${token.enable ? 'btn-warning' : 'btn-success'} btn-sm`} onClick={handleToggleEnable}>
                        {token.enable ? <VscDebugPause size={14} /> : <VscDebugStart size={14} />}
                        {token.enable ? t('buttons.disable') : t('buttons.enable')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                        <VscTrash size={14} />
                        {t('buttons.delete')}
                    </button>
                </div>
            </div>

            <EditTokenModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                token={token}
                onSuccess={onUpdate}
            />
        </>
    );
};

export default TokenCard;
