import axiosClient from '../../api/axiosClient';

// LocalStorage keys (for image gallery only)
const IMAGE_GALLERY_KEY = 'playground_image_gallery';

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
