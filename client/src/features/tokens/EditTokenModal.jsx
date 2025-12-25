import { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import tokenService from './tokenService';

const EditTokenModal = ({ isOpen, onClose, token, onSuccess }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        projectId: '',
        email: ''
    });

    useEffect(() => {
        if (token) {
            setFormData({
                projectId: token.projectId || '',
                email: token.email || ''
            });
        }
    }, [token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await tokenService.update(token.refresh_token, formData);
            if (res.success) {
                showToast(t('messages.saveSuccess'), 'success');
                onSuccess();
                onClose();
            } else {
                showToast(res.message || t('messages.saveFailed'), 'error');
            }
        } catch (err) {
            showToast(err.message || t('messages.saveFailed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!token) return null;

    const expireTime = new Date(token.timestamp + token.expires_in * 1000).toLocaleString('zh-CN');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('tokens.tokenDetails')}
            actions={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        {t('buttons.cancel')}
                    </button>
                    <button className="btn btn-success" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : t('buttons.save')}
                    </button>
                </>
            }
        >
            <div className="form-group">
                <label>{t('tokens.accessTokenReadonly')}</label>
                <div className="token-display">{token.access_token_suffix || token.access_token?.slice(-20) || 'N/A'}</div>
            </div>

            <div className="form-group">
                <label>{t('tokens.refreshTokenReadonly')}</label>
                <div className="token-display">{token.refresh_token?.slice(0, 30)}...</div>
            </div>

            <div className="form-group">
                <label>{t('tokens.projectId')}</label>
                <input
                    type="text"
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleChange}
                    placeholder="Project ID"
                />
            </div>

            <div className="form-group">
                <label>{t('tokens.email')}</label>
                <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email"
                />
            </div>

            <div className="form-group">
                <label>{t('tokens.expireTime')}</label>
                <input
                    type="text"
                    value={expireTime}
                    readOnly
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
            </div>
        </Modal>
    );
};

export default EditTokenModal;
