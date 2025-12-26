/**
 * Chat Session Storage
 * Manages chat session data in local JSON file
 */

import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.js';

const DATA_DIR = getDataDir();
const SESSIONS_FILE = path.join(DATA_DIR, 'chat_sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get all chat sessions
 * @returns {Array} List of chat sessions
 */
export function getChatSessions() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) {
            return [];
        }
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to read chat sessions:', e);
        return [];
    }
}

/**
 * Save all chat sessions
 * @param {Array} sessions - Sessions to save
 */
export function saveChatSessions(sessions) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save chat sessions:', e);
        throw e;
    }
}

/**
 * Create a new chat session
 * @param {string} name - Session name
 * @returns {Object} Created session
 */
export function createChatSession(name = 'New Chat') {
    const session = {
        id: Date.now().toString(),
        name,
        messages: [],
        model: '',
        params: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const sessions = getChatSessions();
    sessions.unshift(session);
    saveChatSessions(sessions);
    return session;
}

/**
 * Get a chat session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session or null
 */
export function getChatSession(sessionId) {
    const sessions = getChatSessions();
    return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Update a chat session
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated session or null
 */
export function updateChatSession(sessionId, updates) {
    const sessions = getChatSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
        sessions[index] = {
            ...sessions[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveChatSessions(sessions);
        return sessions[index];
    }
    return null;
}

/**
 * Delete a chat session
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if deleted
 */
export function deleteChatSession(sessionId) {
    const sessions = getChatSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    if (filtered.length !== sessions.length) {
        saveChatSessions(filtered);
        return true;
    }
    return false;
}

export default {
    getChatSessions,
    saveChatSessions,
    createChatSession,
    getChatSession,
    updateChatSession,
    deleteChatSession
};
