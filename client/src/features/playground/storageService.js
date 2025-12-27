import axiosClient from '../../api/axiosClient';

// ==================== Chat Sessions (API-based) ====================

export const getChatSessions = async () => {
    try {
        const response = await axiosClient.get('/admin/chat-sessions');
        return response.success ? response.data : [];
    } catch (e) {
        console.error('Failed to get chat sessions:', e);
        return [];
    }
};

export const createChatSession = async (name = 'New Chat') => {
    try {
        const response = await axiosClient.post('/admin/chat-sessions', { name });
        return response.success ? response.data : null;
    } catch (e) {
        console.error('Failed to create chat session:', e);
        return null;
    }
};

export const getChatSession = async (sessionId) => {
    try {
        const response = await axiosClient.get(`/admin/chat-sessions/${sessionId}`);
        return response.success ? response.data : null;
    } catch (e) {
        console.error('Failed to get chat session:', e);
        return null;
    }
};

export const updateChatSession = async (sessionId, updates) => {
    try {
        const response = await axiosClient.put(`/admin/chat-sessions/${sessionId}`, updates);
        return response.success ? response.data : null;
    } catch (e) {
        console.error('Failed to update chat session:', e);
        return null;
    }
};

export const deleteChatSession = async (sessionId) => {
    try {
        const response = await axiosClient.delete(`/admin/chat-sessions/${sessionId}`);
        return response.success;
    } catch (e) {
        console.error('Failed to delete chat session:', e);
        return false;
    }
};

// ==================== Image Gallery (API-based) ====================

export const getGalleryImages = async () => {
    try {
        const response = await axiosClient.get('/admin/gallery');
        return response.success ? response.data : [];
    } catch (e) {
        console.error('Failed to get gallery images:', e);
        return [];
    }
};

export const addGalleryImage = async (image) => {
    try {
        const response = await axiosClient.post('/admin/gallery', {
            data: image.data,
            prompt: image.prompt,
            model: image.model
        });
        return response.success ? response.data : null;
    } catch (e) {
        console.error('Failed to add gallery image:', e);
        return null;
    }
};

export const deleteGalleryImage = async (imageId) => {
    try {
        const response = await axiosClient.delete(`/admin/gallery/${imageId}`);
        return response.success;
    } catch (e) {
        console.error('Failed to delete gallery image:', e);
        return false;
    }
};

