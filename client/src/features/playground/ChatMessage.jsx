import { useState } from 'react';
import { VscCopy, VscChevronDown, VscChevronUp, VscEdit, VscCheck, VscClose, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ShinyText from '../../components/common/ShinyText';
import { useI18n } from '../../context/I18nContext';

const getTextContent = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter(item => item && item.type === 'text')
            .map(item => item.text || '')
            .join('\n');
    }
    if (content && typeof content === 'object') {
        if (content.type === 'text') return content.text || '';
        return '';
    }
    return '';
};

const getImages = (content) => {
    if (!content) return [];
    if (Array.isArray(content)) {
        return content
            .filter(item => item && item.type === 'image_url')
            .map(item => item.image_url?.url || '');
    }
    if (typeof content === 'object' && content.type === 'image_url') {
        return [content.image_url?.url || ''];
    }
    return [];
};

const ChatMessage = ({ message, isStreaming, index, onEdit, canEdit, showVersionNav, versionInfo }) => {
    const { t } = useI18n();
    const [showReasoning, setShowReasoning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');

    const isUser = message.role === 'user';
    const hasReasoning = message.reasoning && message.reasoning.length > 0;
    const textContent = getTextContent(message.content);
    const images = getImages(message.content);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(textContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStartEdit = () => {
        setEditContent(textContent);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditContent('');
    };

    const handleSaveEdit = () => {
        if (editContent.trim() && onEdit) {
            onEdit(index, editContent.trim());
        }
        setIsEditing(false);
        setEditContent('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        }
        if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    return (
        <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
            <div className="message-header">
                <span className="message-role">
                    {isUser ? (t('playground.you') || 'You') : (t('playground.assistant') || 'Assistant')}
                </span>
                <div className="message-actions">
                    {isUser && canEdit && !isStreaming && !isEditing && (
                        <button className="btn-icon btn-sm" onClick={handleStartEdit} title={t('playground.editMessage') || 'Edit'}>
                            <VscEdit size={14} />
                        </button>
                    )}
                    {!isUser && (
                        <button className="btn-icon btn-sm" onClick={handleCopy} title="Copy">
                            <VscCopy size={14} />
                            {copied && <span className="copy-toast">Copied!</span>}
                        </button>
                    )}
                </div>
            </div>

            {hasReasoning && (
                <div className="reasoning-section">
                    <button
                        className="reasoning-toggle"
                        onClick={() => setShowReasoning(!showReasoning)}
                    >
                        {isStreaming && !showReasoning ? (
                            <ShinyText
                                text={t('playground.thinking') || 'Thinking...'}
                                speed={2}
                                className="thinking-text"
                            />
                        ) : (
                            <span>{t('playground.reasoning') || 'Reasoning'}</span>
                        )}
                        {showReasoning ? <VscChevronUp size={14} /> : <VscChevronDown size={14} />}
                    </button>

                    {showReasoning && (
                        <div className="reasoning-content">
                            <pre>{message.reasoning}</pre>
                        </div>
                    )}
                </div>
            )}

            {images.length > 0 && (
                <div className="message-images">
                    {images.map((imgUrl, idx) => (
                        <div key={idx} className="message-image-wrapper">
                            <img
                                src={imgUrl}
                                alt={`Image ${idx + 1}`}
                                className="message-image"
                                onClick={() => setExpandedImage(imgUrl)}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="message-content markdown-body">
                {isEditing ? (
                    <div className="message-edit-area">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            rows={3}
                        />
                        <div className="message-edit-actions">
                            <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}>
                                <VscCheck size={14} />
                                {t('playground.saveEdit') || 'Save'}
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>
                                <VscClose size={14} />
                                {t('playground.cancelEdit') || 'Cancel'}
                            </button>
                        </div>
                    </div>
                ) : textContent ? (
                    <>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {textContent}
                        </ReactMarkdown>
                        {isStreaming && <span className="cursor-blink">▌</span>}
                    </>
                ) : (
                    isStreaming && !hasReasoning && (
                        <ShinyText
                            text={t('playground.generating') || 'Generating...'}
                            speed={2}
                        />
                    )
                )}
            </div>

            {/* Version Navigation - shown under the reverted message */}
            {showVersionNav && versionInfo && (
                <div className="version-navigation">
                    <button
                        className="version-nav-btn"
                        onClick={versionInfo.onBack}
                        disabled={!versionInfo.canGoBack}
                        title={t('playground.previousVersion') || 'Previous version'}
                    >
                        <VscChevronLeft size={16} />
                    </button>
                    <span className="version-indicator">
                        {versionInfo.current} / {versionInfo.total}
                    </span>
                    <button
                        className="version-nav-btn"
                        onClick={versionInfo.onForward}
                        disabled={!versionInfo.canGoForward}
                        title={t('playground.nextVersion') || 'Next version'}
                    >
                        <VscChevronRight size={16} />
                    </button>
                </div>
            )}

            {expandedImage && (
                <div className="image-viewer-overlay" onClick={() => setExpandedImage(null)}>
                    <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
                        <img src={expandedImage} alt="Expanded view" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
