import { createContext, useContext, useState } from 'react';
import Modal from '../components/common/Modal';
import { useI18n } from './I18nContext';

const ConfirmContext = createContext({
    confirm: (message, title) => Promise.resolve(false),
});

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState({ isOpen: false, message: '', title: '', resolve: null });
    const { t } = useI18n();

    const confirm = (message, title) => {
        return new Promise((resolve) => {
            setState({ isOpen: true, message, title, resolve });
        });
    };

    const handleClose = (result) => {
        if (state.resolve) state.resolve(result);
        setState({ isOpen: false, message: '', title: '', resolve: null });
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Modal
                isOpen={state.isOpen}
                onClose={() => handleClose(false)}
                title={state.title || t('modals.confirmOperation')}
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => handleClose(false)}>{t('buttons.cancel')}</button>
                        <button className="btn btn-danger" onClick={() => handleClose(true)}>{t('buttons.confirm')}</button>
                    </>
                }
            >
                <div className="modal-message">{state.message}</div>
            </Modal>
        </ConfirmContext.Provider>
    );
};
