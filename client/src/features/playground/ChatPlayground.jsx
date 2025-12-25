import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { VscSettingsGear, VscAdd, VscTrash, VscSend, VscClose } from 'react-icons/vsc';
import ChatMessage from './ChatMessage';
import ChatSessionHistory from './ChatSessionHistory';
import ParameterModal from './ParameterModal';
import { getChatModels, streamChatCompletion } from './playgroundService';
import {
    getChatSessions,
    createChatSession,
    updateChatSession,
    deleteChatSession,
    getChatSession
} from './storageService';

const DEFAULT_PARAMS = {
    temperature: 0.7,
    max_tokens: 16384, // Higher default to support thinking models
    top_p: 1,
    reasoning_effort: 'none'
};

const ChatPlayground = () => {
    const { t } = useI18n();
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showParams, setShowParams] = useState(false);
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedImages, setSelectedImages] = useState([]);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Detect actual MIME type from base64 data
    const detectMimeType = (base64) => {
        const signatures = {
            '/9j/': 'image/jpeg',
            'iVBORw0KGgo': 'image/png',
            'R0lGOD': 'image/gif',
            'UklGR': 'image/webp',
            'Qk0': 'image/bmp'
        };
        for (const [sig, mime] of Object.entries(signatures)) {
            if (base64.startsWith(sig)) return mime;
        }
        return null;
    };

    // Convert file to base64 with correct MIME type
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result;
                // Extract the base64 part and detect actual MIME type
                const base64Match = result.match(/^data:([^;]+);base64,(.+)$/);
                if (base64Match) {
                    const base64Data = base64Match[2];
                    const detectedMime = detectMimeType(base64Data);
                    if (detectedMime && detectedMime !== base64Match[1]) {
                        // Rebuild with correct MIME type
                        resolve(`data:${detectedMime};base64,${base64Data}`);
                    } else {
                        resolve(result);
                    }
                } else {
                    resolve(result);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    };

    // Handle image selection
    const handleImageSelect = async (e) => {
        const files = Array.from(e.target.files);
        const maxFiles = 3;
        const maxSize = 5 * 1024 * 1024; // 5MB

        const validFiles = files.filter(file => {
            if (file.size > maxSize) {
                console.warn(`File ${file.name} is too large (max 5MB)`);
                return false;
            }
            return true;
        }).slice(0, maxFiles - selectedImages.length);

        const newImages = await Promise.all(
            validFiles.map(async (file) => ({
                file,
                preview: URL.createObjectURL(file),
                base64: await fileToBase64(file)
            }))
        );

        setSelectedImages(prev => [...prev, ...newImages].slice(0, maxFiles));
        e.target.value = ''; // Reset input
    };

    // Remove image from selection
    const handleRemoveImage = (index) => {
        setSelectedImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    };

    // Build message content with images
    const buildMessageContent = (text, images) => {
        if (images.length === 0) {
            return text;
        }
        const content = [];
        if (text.trim()) {
            content.push({ type: 'text', text: text.trim() });
        }
        images.forEach(img => {
            content.push({
                type: 'image_url',
                image_url: { url: img.base64 }
            });
        });
        return content;
    };

    // Load models on mount
    useEffect(() => {
        const loadModels = async () => {
            try {
                const chatModels = await getChatModels();
                setModels(chatModels);
                if (chatModels.length > 0 && !selectedModel) {
                    setSelectedModel(chatModels[0].id);
                }
            } catch (error) {
                console.error('Failed to load models:', error);
            }
        };
        loadModels();
    }, []);

    // Load sessions on mount
    useEffect(() => {
        const loadedSessions = getChatSessions();
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
            setCurrentSessionId(loadedSessions[0].id);
            setMessages(loadedSessions[0].messages || []);
            if (loadedSessions[0].model) {
                setSelectedModel(loadedSessions[0].model);
            }
            if (loadedSessions[0].params) {
                setParams({ ...DEFAULT_PARAMS, ...loadedSessions[0].params });
            }
        }
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleNewSession = () => {
        const newSession = createChatSession();
        setSessions([newSession, ...sessions]);
        setCurrentSessionId(newSession.id);
        setMessages([]);
        setParams(DEFAULT_PARAMS);
    };

    const handleSelectSession = (sessionId) => {
        const session = getChatSession(sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
            setMessages(session.messages || []);
            if (session.model) setSelectedModel(session.model);
            if (session.params) setParams({ ...DEFAULT_PARAMS, ...session.params });
        }
    };

    const handleDeleteSession = (sessionId) => {
        deleteChatSession(sessionId);
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(updatedSessions);
        if (currentSessionId === sessionId) {
            if (updatedSessions.length > 0) {
                handleSelectSession(updatedSessions[0].id);
            } else {
                setCurrentSessionId(null);
                setMessages([]);
            }
        }
    };

    const handleSend = async () => {
        if ((!inputValue.trim() && selectedImages.length === 0) || isStreaming) return;

        // Auto-create session if none exists
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            const newSession = createChatSession('New Chat');
            setSessions(prev => [newSession, ...prev]);
            setCurrentSessionId(newSession.id);
            activeSessionId = newSession.id;
        }

        const messageContent = buildMessageContent(inputValue, selectedImages);
        const userMessage = {
            role: 'user',
            content: messageContent
        };

        // Clear selected images
        selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
        setSelectedImages([]);

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputValue('');
        setIsStreaming(true);

        // Add assistant placeholder
        const assistantMessage = {
            role: 'assistant',
            content: '',
            reasoning: ''
        };
        setMessages([...newMessages, assistantMessage]);

        let fullContent = '';
        let fullReasoning = '';

        await streamChatCompletion(
            newMessages,
            selectedModel,
            {
                temperature: params.temperature,
                max_tokens: params.max_tokens,
                top_p: params.top_p,
                ...(params.reasoning_effort !== 'none' && { reasoning_effort: params.reasoning_effort }),
                ...(params.prompt_caching && { prompt_caching: true })
            },
            (chunk) => {
                const delta = chunk.choices?.[0]?.delta;
                if (delta?.content) {
                    fullContent += delta.content;
                }
                if (delta?.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                }
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: fullContent,
                        reasoning: fullReasoning
                    };
                    return updated;
                });
            },
            async () => {
                setIsStreaming(false);
                // Save to session
                const finalMessages = [...newMessages, { role: 'assistant', content: fullContent, reasoning: fullReasoning }];

                // Auto-generate session name if it's the first exchange
                let sessionUpdate = {
                    messages: finalMessages,
                    model: selectedModel,
                    params
                };

                // Generate title from first user message (if session is new)
                const session = getChatSession(activeSessionId);
                if (session && (!session.messages || session.messages.length === 0)) {
                    // Generate a short title based on the first message
                    const title = inputValue.trim().slice(0, 40) + (inputValue.length > 40 ? '...' : '');
                    sessionUpdate.name = title;
                }

                updateChatSession(activeSessionId, sessionUpdate);
                setSessions(getChatSessions());
            },
            (error) => {
                console.error('Stream error:', error);
                setIsStreaming(false);
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: `Error: ${error.message}`,
                        reasoning: ''
                    };
                    return updated;
                });
            }
        );
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const canSend = (inputValue.trim() || selectedImages.length > 0) && !isStreaming;

    return (
        <div className="chat-playground">
            {/* Sidebar toggle for mobile */}
            <button
                className="sidebar-toggle btn-ghost"
                onClick={() => setShowSidebar(!showSidebar)}
            >
                ☰
            </button>

            {/* Session History Sidebar */}
            <ChatSessionHistory
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
                onNew={handleNewSession}
                isVisible={showSidebar}
                onClose={() => setShowSidebar(false)}
            />

            {/* Main Chat Area */}
            <div className="chat-main">
                {/* Header */}
                <div className="chat-header">
                    <select
                        className="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                    </select>

                    <button
                        className="btn-icon"
                        onClick={() => setShowParams(true)}
                        title={t('playground.settings') || 'Settings'}
                    >
                        <VscSettingsGear size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <p>{t('playground.startChat') || 'Start a new conversation'}</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <ChatMessage
                                key={index}
                                message={msg}
                                isStreaming={isStreaming && index === messages.length - 1}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="chat-input-area">
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                    />

                    {/* Image preview */}
                    {selectedImages.length > 0 && (
                        <div className="selected-images-preview">
                            {selectedImages.map((img, index) => (
                                <div key={index} className="image-thumbnail">
                                    <img src={img.preview} alt={`Selected ${index + 1}`} />
                                    <button
                                        className="remove-image-btn"
                                        onClick={() => handleRemoveImage(index)}
                                        title="Remove"
                                    >
                                        <VscClose size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="input-row">
                        {/* Upload button */}
                        <button
                            className="btn-icon image-upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isStreaming || selectedImages.length >= 3}
                            title={t('playground.uploadImage') || 'Upload image'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21,15 16,10 5,21" />
                            </svg>
                        </button>

                        <textarea
                            className="chat-input"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('playground.typeMessage') || 'Type a message...'}
                            disabled={isStreaming}
                            rows={1}
                        />
                        <button
                            className="send-btn btn-primary"
                            onClick={handleSend}
                            disabled={!canSend}
                        >
                            <VscSend size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Parameter Modal */}
            <ParameterModal
                isOpen={showParams}
                onClose={() => setShowParams(false)}
                params={params}
                onSave={setParams}
            />
        </div>
    );
};

export default ChatPlayground;
