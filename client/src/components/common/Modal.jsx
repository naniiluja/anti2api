import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, onClose, title, children, actions, size = 'md' }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClass = size === 'xl' ? 'modal-xl' : size === 'lg' ? 'modal-lg' : '';

    return createPortal(
        <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal-content ${sizeClass}`}>
                {title && <div className="modal-title">{title}</div>}
                {children}
                {actions && <div className="modal-actions">{actions}</div>}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
