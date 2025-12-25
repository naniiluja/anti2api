import { useState } from 'react';
import { VscCopy, VscChevronDown, VscChevronUp } from 'react-icons/vsc';
import ShinyText from '../../components/common/ShinyText';
import { useI18n } from '../../context/I18nContext';

// Extract text content from message (handles string, array, and object formats)
const getTextContent = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter(item => item && item.type === 'text')
            .map(item => item.text || '')
            .join('\n');
    }
    // Handle single object content
    if (content && typeof content === 'object') {
        if (content.type === 'text') return content.text || '';
        return '';
    }
    return '';
};

// Extract images from message content
const getImages = (content) => {
    if (!content) return [];
    if (Array.isArray(content)) {
        return content
            .filter(item => item && item.type === 'image_url')
            .map(item => item.image_url?.url || '');
    }
    // Handle single object content
    if (typeof content === 'object' && content.type === 'image_url') {
        return [content.image_url?.url || ''];
    }
    return [];
};

const ChatMessage = ({ message, isStreaming }) => {
    const { t } = useI18n();
    const [showReasoning, setShowReasoning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [expandedImage, setExpandedImage] = useState(null);

    const isUser = message.role === 'user';
    const hasReasoning = message.reasoning && message.reasoning.length > 0;
    const textContent = getTextContent(message.content);
    const images = getImages(message.content);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(textContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
            <div className="message-header">
                <span className="message-role">
                    {isUser ? (t('playground.you') || 'You') : (t('playground.assistant') || 'Assistant')}
                </span>
                {!isUser && (
                    <button className="btn-icon btn-sm" onClick={handleCopy} title="Copy">
                        <VscCopy size={14} />
                        {copied && <span className="copy-toast">Copied!</span>}
                    </button>
                )}
            </div>

            {/* Reasoning section with ShinyText */}
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

            {/* Images */}
            {images.length > 0 && (
                <div className="message-images">
                    {images.map((imgUrl, index) => (
                        <div key={index} className="message-image-wrapper">
                            <img
                                src={imgUrl}
                                alt={`Image ${index + 1}`}
                                className="message-image"
                                onClick={() => setExpandedImage(imgUrl)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Main content */}
            <div className="message-content">
                {textContent || (isStreaming && !hasReasoning && (
                    <ShinyText
                        text={t('playground.generating') || 'Generating...'}
                        speed={2}
                    />
                ))}
                {isStreaming && textContent && <span className="cursor-blink">▌</span>}
            </div>

            {/* Expanded image overlay */}
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
