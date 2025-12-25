import { VscAdd, VscTrash, VscClose } from 'react-icons/vsc';
import { useI18n } from '../../context/I18nContext';

const ChatSessionHistory = ({
    sessions,
    currentSessionId,
    onSelect,
    onDelete,
    onNew,
    isVisible,
    onClose
}) => {
    const { t } = useI18n();

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Get text preview from content (handles string, array, object formats)
    const getContentPreview = (content, maxLen = 50) => {
        if (!content) return 'Empty';
        if (typeof content === 'string') {
            return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');
        }
        if (Array.isArray(content)) {
            const textItem = content.find(item => item && item.type === 'text');
            const text = textItem?.text || '';
            const hasImage = content.some(item => item && item.type === 'image_url');
            const prefix = hasImage ? '🖼️ ' : '';
            return prefix + (text.slice(0, maxLen) + (text.length > maxLen ? '...' : '') || (hasImage ? 'Image' : 'Empty'));
        }
        if (typeof content === 'object' && content.type === 'text') {
            const text = content.text || '';
            return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '');
        }
        return 'Empty';
    };

    return (
        <div className={`chat-sidebar ${isVisible ? 'visible' : ''}`}>
            <div className="sidebar-header">
                <h3>{t('playground.history') || 'History'}</h3>
                <div className="sidebar-actions">
                    <button className="btn-icon" onClick={onNew} title={t('playground.newChat') || 'New Chat'}>
                        <VscAdd size={18} />
                    </button>
                    <button className="btn-icon sidebar-close" onClick={onClose}>
                        <VscClose size={18} />
                    </button>
                </div>
            </div>

            <div className="session-list">
                {sessions.length === 0 ? (
                    <div className="session-empty">
                        <p>{t('playground.noSessions') || 'No chat sessions yet'}</p>
                        <button className="btn btn-primary btn-sm" onClick={onNew}>
                            <VscAdd size={14} />
                            {t('playground.startNew') || 'Start New'}
                        </button>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                            onClick={() => onSelect(session.id)}
                        >
                            <div className="session-info">
                                <span className="session-name">{session.name}</span>
                                <span className="session-date">{formatDate(session.updatedAt)}</span>
                                <span className="session-preview">
                                    {getContentPreview(session.messages?.[0]?.content)}
                                </span>
                            </div>
                            <button
                                className="btn-icon btn-danger-hover"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(session.id);
                                }}
                                title={t('common.delete') || 'Delete'}
                            >
                                <VscTrash size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChatSessionHistory;
