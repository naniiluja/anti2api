import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { VscSettingsGear, VscSend, VscClose, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';
import ChatMessage from './ChatMessage';
import ChatSessionHistory from './ChatSessionHistory';
import ParameterModal from './ParameterModal';
import { getChatModels, streamChatCompletion, improveChatPrompt } from './playgroundService';
import {
    getChatSessions,
    createChatSession,
    updateChatSession,
    deleteChatSession,
    getChatSession
} from './storageService';

const DEFAULT_PARAMS = {
    temperature: 0.7,
    max_tokens: 16384,
    top_p: 1,
    reasoning_effort: 'none'
};

const MAX_VERSIONS = 10;

const ChatPlayground = () => {
    const { t } = useI18n();
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showParams, setShowParams] = useState(false);
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isImproving, setIsImproving] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);

    // Version history state
    const [messageVersions, setMessageVersions] = useState([]);
    const [versionIndex, setVersionIndex] = useState(-1);
    const [revertedAtIndex, setRevertedAtIndex] = useState(-1); // Index of the message that was edited

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

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

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result;
                const base64Match = result.match(/^data:([^;]+);base64,(.+)$/);
                if (base64Match) {
                    const base64Data = base64Match[2];
                    const detectedMime = detectMimeType(base64Data);
                    if (detectedMime && detectedMime !== base64Match[1]) {
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

    const handleImageSelect = async (e) => {
        const files = Array.from(e.target.files);
        const maxFiles = 3;
        const maxSize = 5 * 1024 * 1024;

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
        e.target.value = '';
    };

    const handleRemoveImage = (index) => {
        setSelectedImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    };

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

    useEffect(() => {
        const loadSessions = async () => {
            setIsLoading(true);
            try {
                const loadedSessions = await getChatSessions();
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
                    // Load version history if exists
                    if (loadedSessions[0].versions) {
                        setMessageVersions(loadedSessions[0].versions);
                        setVersionIndex(loadedSessions[0].versionIndex ?? loadedSessions[0].versions.length - 1);
                        setRevertedAtIndex(loadedSessions[0].revertedAtIndex ?? -1);
                    }
                }
            } catch (e) {
                console.error('Failed to load sessions:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadSessions();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load version history when switching sessions
    const handleSelectSession = async (sessionId) => {
        const session = await getChatSession(sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
            setMessages(session.messages || []);
            if (session.model) setSelectedModel(session.model);
            if (session.params) setParams({ ...DEFAULT_PARAMS, ...session.params });
            // Load version history if exists
            if (session.versions && session.versions.length > 0) {
                setMessageVersions(session.versions);
                setVersionIndex(session.versionIndex ?? session.versions.length - 1);
                setRevertedAtIndex(session.revertedAtIndex ?? -1);
            } else {
                setMessageVersions([]);
                setVersionIndex(-1);
                setRevertedAtIndex(-1);
            }
        }
    };

    const handleNewSession = async () => {
        const newSession = await createChatSession();
        if (newSession) {
            setSessions(prev => [newSession, ...prev]);
            setCurrentSessionId(newSession.id);
            setMessages([]);
            setParams(DEFAULT_PARAMS);
            // Reset version history
            setMessageVersions([]);
            setVersionIndex(-1);
            setRevertedAtIndex(-1);
        }
    };

    const handleDeleteSession = async (sessionId) => {
        await deleteChatSession(sessionId);
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(updatedSessions);
        if (currentSessionId === sessionId) {
            if (updatedSessions.length > 0) {
                await handleSelectSession(updatedSessions[0].id);
            } else {
                setCurrentSessionId(null);
                setMessages([]);
                setMessageVersions([]);
                setVersionIndex(-1);
            }
        }
    };

    // Save current state to version history (before edit)
    const saveToVersionHistory = (currentMessages, editIndex) => {
        if (currentMessages.length === 0) return;

        setMessageVersions(prev => {
            // If we're not at the end of history, truncate forward history
            let newVersions = versionIndex >= 0 ? prev.slice(0, versionIndex + 1) : [...prev];

            // Add current state (the state BEFORE edit)
            newVersions.push({
                messages: [...currentMessages],
                timestamp: Date.now(),
                editIndex: editIndex
            });

            // Limit to MAX_VERSIONS
            if (newVersions.length > MAX_VERSIONS) {
                newVersions = newVersions.slice(-MAX_VERSIONS);
            }

            return newVersions;
        });

        // Don't update versionIndex yet - it will be updated after new response is added
        setRevertedAtIndex(editIndex);
    };

    // Add the new state (after edit) to version history and save to session
    const addNewVersionToHistory = async (newMessages, editIndex, sessionId) => {
        // Use Promise to get the updated versions from functional setState
        const updatedVersions = await new Promise(resolve => {
            setMessageVersions(prev => {
                let newVersions = [...prev];

                // Add new state (the state AFTER edit)
                newVersions.push({
                    messages: [...newMessages],
                    timestamp: Date.now(),
                    editIndex: editIndex
                });

                // Limit to MAX_VERSIONS
                if (newVersions.length > MAX_VERSIONS) {
                    newVersions = newVersions.slice(-MAX_VERSIONS);
                }

                // Resolve with the new versions after setState processes
                setTimeout(() => resolve(newVersions), 0);
                return newVersions;
            });
        });

        const newIndex = updatedVersions.length - 1;
        setVersionIndex(newIndex);

        // Save versions to session storage
        if (sessionId && updatedVersions.length > 0) {
            await updateChatSession(sessionId, {
                versions: updatedVersions,
                versionIndex: newIndex,
                revertedAtIndex: editIndex
            });
        }
    };

    // Navigate version history
    const handleVersionNav = async (direction) => {
        if (messageVersions.length === 0) return;

        let newIndex;
        if (direction === 'back') {
            newIndex = Math.max(0, versionIndex - 1);
        } else {
            newIndex = Math.min(messageVersions.length - 1, versionIndex + 1);
        }

        if (newIndex !== versionIndex && messageVersions[newIndex]) {
            setVersionIndex(newIndex);
            const newMessages = [...messageVersions[newIndex].messages];
            setMessages(newMessages);

            // Save the navigation state to session
            if (currentSessionId) {
                await updateChatSession(currentSessionId, {
                    messages: newMessages,
                    versionIndex: newIndex
                });
            }
        }
    };

    // Handle message edit
    const handleEditMessage = async (index, newContent) => {
        if (isStreaming) return;

        // Save current state to history before editing
        saveToVersionHistory(messages, index);

        // Truncate messages to the edited message (keep messages before it)
        const truncatedMessages = messages.slice(0, index);

        // Create new user message with edited content
        const editedMessage = {
            role: 'user',
            content: newContent
        };

        const newMessages = [...truncatedMessages, editedMessage];
        setMessages(newMessages);
        setIsStreaming(true);

        // Auto-create session if none exists
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            const newSession = await createChatSession('New Chat');
            if (newSession) {
                setSessions(prev => [newSession, ...prev]);
                setCurrentSessionId(newSession.id);
                activeSessionId = newSession.id;
            }
        }

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
                const finalMessages = [...newMessages, { role: 'assistant', content: fullContent, reasoning: fullReasoning }];

                // Add the new version to history after edit is complete and save to storage
                await addNewVersionToHistory(finalMessages, index, activeSessionId);

                await updateChatSession(activeSessionId, {
                    messages: finalMessages,
                    model: selectedModel,
                    params
                });
                const updatedSessions = await getChatSessions();
                setSessions(updatedSessions);
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

    const handleSend = async () => {
        if ((!inputValue.trim() && selectedImages.length === 0) || isStreaming) return;

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            const newSession = await createChatSession('New Chat');
            if (newSession) {
                setSessions(prev => [newSession, ...prev]);
                setCurrentSessionId(newSession.id);
                activeSessionId = newSession.id;
            }
        }

        const messageContent = buildMessageContent(inputValue, selectedImages);
        const userMessage = {
            role: 'user',
            content: messageContent
        };

        selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
        setSelectedImages([]);

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputValue('');
        setIsStreaming(true);

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
                const finalMessages = [...newMessages, { role: 'assistant', content: fullContent, reasoning: fullReasoning }];

                let sessionUpdate = {
                    messages: finalMessages,
                    model: selectedModel,
                    params
                };

                const session = await getChatSession(activeSessionId);
                if (session && (!session.messages || session.messages.length === 0)) {
                    const title = inputValue.trim().slice(0, 40) + (inputValue.length > 40 ? '...' : '');
                    sessionUpdate.name = title;
                }

                await updateChatSession(activeSessionId, sessionUpdate);
                const updatedSessions = await getChatSessions();
                setSessions(updatedSessions);
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
    const hasVersionHistory = messageVersions.length > 0;
    const canGoBack = hasVersionHistory && versionIndex > 0;

    const handleImprovePrompt = async () => {
        if (!inputValue.trim() || isImproving || isStreaming) return;
        setIsImproving(true);
        try {
            const improved = await improveChatPrompt(inputValue);
            setInputValue(improved);
        } catch (error) {
            console.error('Failed to improve prompt:', error);
        } finally {
            setIsImproving(false);
        }
    };
    const canGoForward = hasVersionHistory && versionIndex < messageVersions.length - 1;

    return (
        <div className="chat-playground">
            <button
                className="sidebar-toggle btn-ghost"
                onClick={() => setShowSidebar(!showSidebar)}
            >
                ☰
            </button>

            <ChatSessionHistory
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
                onNew={handleNewSession}
                isVisible={showSidebar}
                onClose={() => setShowSidebar(false)}
            />

            <div className="chat-main">
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

                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <p>{t('playground.startChat') || 'Start a new conversation'}</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <ChatMessage
                                key={index}
                                index={index}
                                message={msg}
                                isStreaming={isStreaming && index === messages.length - 1}
                                onEdit={handleEditMessage}
                                canEdit={!isStreaming && msg.role === 'user'}
                                showVersionNav={hasVersionHistory && index === revertedAtIndex}
                                versionInfo={{
                                    current: versionIndex + 1,
                                    total: messageVersions.length,
                                    canGoBack: canGoBack && !isStreaming,
                                    canGoForward: canGoForward && !isStreaming,
                                    onBack: () => handleVersionNav('back'),
                                    onForward: () => handleVersionNav('forward')
                                }}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>



                <div className="chat-input-area">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                    />

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

                        <div className="chat-input-wrapper">
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
                                className="improve-prompt-btn"
                                onClick={handleImprovePrompt}
                                disabled={!inputValue.trim() || isImproving || isStreaming}
                                title={t('playground.improvePrompt') || 'Improve prompt'}
                            >
                                {isImproving ? (
                                    <span className="improve-spinner"></span>
                                ) : (
                                    <span className="improve-icon">✨</span>
                                )}
                            </button>
                        </div>
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
