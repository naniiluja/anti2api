// LocalStorage keys
const CHAT_SESSIONS_KEY = 'playground_chat_sessions';
const IMAGE_GALLERY_KEY = 'playground_image_gallery';

// Chat Sessions
export const getChatSessions = () => {
    try {
        const data = localStorage.getItem(CHAT_SESSIONS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to get chat sessions:', e);
        return [];
    }
};

export const saveChatSessions = (sessions) => {
    try {
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
        console.error('Failed to save chat sessions:', e);
    }
};

export const createChatSession = (name = 'New Chat') => {
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
};

export const getChatSession = (sessionId) => {
    const sessions = getChatSessions();
    return sessions.find(s => s.id === sessionId);
};

export const updateChatSession = (sessionId, updates) => {
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
};

export const deleteChatSession = (sessionId) => {
    const sessions = getChatSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    saveChatSessions(filtered);
};

// Image Gallery
export const getGalleryImages = () => {
    try {
        const data = localStorage.getItem(IMAGE_GALLERY_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to get gallery images:', e);
        return [];
    }
};

export const saveGalleryImages = (images) => {
    try {
        localStorage.setItem(IMAGE_GALLERY_KEY, JSON.stringify(images));
    } catch (e) {
        console.error('Failed to save gallery images:', e);
    }
};

export const addGalleryImage = (image) => {
    const images = getGalleryImages();
    const newImage = {
        ...image,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
    };
    images.unshift(newImage);
    // Keep only last 50 images
    saveGalleryImages(images.slice(0, 50));
    return newImage;
};

export const deleteGalleryImage = (imageId) => {
    const images = getGalleryImages();
    const filtered = images.filter(img => img.id !== imageId);
    saveGalleryImages(filtered);
};
