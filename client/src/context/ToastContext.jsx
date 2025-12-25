import { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const ToastContext = createContext({
    showToast: (message, type, title) => { },
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', title = '') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, title }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onClose }) => {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    return (
        <div className={`toast ${toast.type}`} onClick={onClose} style={{ cursor: 'pointer', animation: 'slideIn 0.3s ease' }}>
            <div className="toast-icon">{icons[toast.type]}</div>
            <div className="toast-content">
                {toast.title && <div className="toast-title">{toast.title}</div>}
                <div className="toast-message">{toast.message}</div>
            </div>
        </div>
    );
};

ToastProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

ToastItem.propTypes = {
    toast: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};
