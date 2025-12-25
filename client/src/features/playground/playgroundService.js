import axiosClient from '../../api/axiosClient';

const API_BASE = '/v1';
const SD_API_BASE = '/sdapi/v1';

// Fetch all models
export const getModels = async () => {
    const response = await axiosClient.get(`${API_BASE}/models`);
    return response.data || [];
};

// Get chat models (exclude image models)
export const getChatModels = async () => {
    const models = await getModels();
    return models.filter(m => !m.id.toLowerCase().includes('image'));
};

// Get image models only
export const getImageModels = async () => {
    const models = await getModels();
    return models.filter(m => m.id.toLowerCase().includes('image'));
};

// Stream chat completion
export const streamChatCompletion = async (messages, model, params = {}, onChunk, onDone, onError) => {
    try {
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
                ...params
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        onDone?.();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        onChunk?.(parsed);
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
        onDone?.();
    } catch (error) {
        onError?.(error);
    }
};

// Non-streaming chat completion
export const chatCompletion = async (messages, model, params = {}) => {
    const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            ...params
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
};

// Text to image generation
export const generateImage = async (prompt, model = 'gemini-3-pro-image') => {
    try {
        const response = await axiosClient.post(`${SD_API_BASE}/txt2img`, {
            prompt,
            model
        });
        return response;
    } catch (error) {
        console.error('[ImageGen] Text-to-Image Error:', {
            status: error.response?.status,
            message: error.response?.data?.error || error.message,
            prompt: prompt.slice(0, 50) + '...',
            model
        });
        throw new Error(
            error.response?.data?.error ||
            `Image generation failed (${error.response?.status || 'Network Error'})`
        );
    }
};

// Image to image transformation
export const transformImage = async (prompt, initImages, model = 'gemini-3-pro-image') => {
    try {
        const response = await axiosClient.post(`${SD_API_BASE}/img2img`, {
            prompt,
            init_images: initImages,
            model
        });
        return response;
    } catch (error) {
        console.error('[ImageGen] Image-to-Image Error:', {
            status: error.response?.status,
            message: error.response?.data?.error || error.message,
            prompt: prompt.slice(0, 50) + '...',
            model
        });
        throw new Error(
            error.response?.data?.error ||
            `Image transformation failed (${error.response?.status || 'Network Error'})`
        );
    }
};
