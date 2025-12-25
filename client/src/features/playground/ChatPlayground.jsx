import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { VscSettingsGear, VscAdd, VscTrash, VscSend } from 'react-icons/vsc';
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
    const messagesEndRef = useRef(null);

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
        if (!inputValue.trim() || isStreaming) return;

        // Auto-create session if none exists
        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            const newSession = createChatSession('New Chat');
            setSessions(prev => [newSession, ...prev]);
            setCurrentSessionId(newSession.id);
            activeSessionId = newSession.id;
        }

        const userMessage = {
            role: 'user',
            content: inputValue.trim()
        };

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
                ...(params.reasoning_effort !== 'none' && { reasoning_effort: params.reasoning_effort })
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
                        disabled={!inputValue.trim() || isStreaming}
                    >
                        <VscSend size={18} />
                    </button>
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
