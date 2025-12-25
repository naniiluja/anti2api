import { useState } from 'react';
import { VscCopy, VscChevronDown, VscChevronUp } from 'react-icons/vsc';
import ShinyText from '../../components/common/ShinyText';
import { useI18n } from '../../context/I18nContext';

const ChatMessage = ({ message, isStreaming }) => {
    const { t } = useI18n();
    const [showReasoning, setShowReasoning] = useState(false);
    const [copied, setCopied] = useState(false);

    const isUser = message.role === 'user';
    const hasReasoning = message.reasoning && message.reasoning.length > 0;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(message.content);
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

            {/* Main content */}
            <div className="message-content">
                {message.content || (isStreaming && !hasReasoning && (
                    <ShinyText
                        text={t('playground.generating') || 'Generating...'}
                        speed={2}
                    />
                ))}
                {isStreaming && message.content && <span className="cursor-blink">▌</span>}
            </div>
        </div>
    );
};

export default ChatMessage;
