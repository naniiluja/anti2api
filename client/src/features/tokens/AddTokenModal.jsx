import { useState } from 'react';
import Modal from '../../components/common/Modal';
import { useI18n } from '../../context/I18nContext';
import { useToast } from '../../context/ToastContext';
import tokenService from './tokenService';

const AddTokenModal = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        access_token: '',
        refresh_token: '',
        expires_in: 3599
    });

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.access_token || !formData.refresh_token) {
            showToast(t('messages.pleaseInputComplete'), 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await tokenService.add({
                access_token: formData.access_token,
                refresh_token: formData.refresh_token,
                expires_in: parseInt(formData.expires_in)
            });

            if (res.success) {
                showToast(t('messages.tokenAdded'), 'success');
                onSuccess();
                onClose();
                setFormData({ access_token: '', refresh_token: '', expires_in: 3599 });
            } else {
                showToast(res.message || t('messages.addFailed'), 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`✏️ ${t('modals.manualAdd')}`}
            actions={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>{t('buttons.cancel')}</button>
                    <button className="btn btn-success" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Adding...' : `✅ ${t('buttons.add')}`}
                    </button>
                </>
            }
        >
            <div className="form-modal">
                <div className="form-row">
                    <input
                        type="text"
                        id="access_token"
                        placeholder={t('modals.accessTokenRequired')}
                        value={formData.access_token}
                        onChange={handleChange}
                    />
                    <input
                        type="text"
                        id="refresh_token"
                        placeholder={t('modals.refreshTokenRequired')}
                        value={formData.refresh_token}
                        onChange={handleChange}
                    />
                    <input
                        type="number"
                        id="expires_in"
                        placeholder={t('modals.expiresIn')}
                        value={formData.expires_in}
                        onChange={handleChange}
                    />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                    💡 {t('modals.expiresInHint')}
                </p>
            </div>
        </Modal>
    );
};

export default AddTokenModal;
