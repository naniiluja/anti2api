import { VscClose, VscTrash } from 'react-icons/vsc';
import { useI18n } from '../../context/I18nContext';

const ImageGallery = ({
    images,
    onSelect,
    onDelete,
    isVisible,
    onClose
}) => {
    const { t } = useI18n();

    return (
        <div className={`image-sidebar ${isVisible ? 'visible' : ''}`}>
            <div className="sidebar-header">
                <h3>{t('playground.gallery') || 'Gallery'}</h3>
                <button className="btn-icon sidebar-close" onClick={onClose}>
                    <VscClose size={18} />
                </button>
            </div>

            <div className="gallery-grid">
                {images.length === 0 ? (
                    <div className="gallery-empty">
                        <p>{t('playground.noImages') || 'No images saved yet'}</p>
                    </div>
                ) : (
                    images.map(image => (
                        <div
                            key={image.id}
                            className="gallery-item"
                            onClick={() => onSelect(image)}
                        >
                            <img
                                src={`data:image/png;base64,${image.data}`}
                                alt={image.prompt || 'Generated'}
                            />
                            <div className="gallery-item-overlay">
                                <button
                                    className="btn-icon btn-danger-hover"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(image.id);
                                    }}
                                    title={t('common.delete') || 'Delete'}
                                >
                                    <VscTrash size={14} />
                                </button>
                            </div>
                            <div className="gallery-item-prompt">
                                {image.prompt?.slice(0, 30) || 'No prompt'}
                                {image.prompt?.length > 30 ? '...' : ''}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ImageGallery;
