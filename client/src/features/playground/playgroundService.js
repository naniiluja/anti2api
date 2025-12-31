import axiosClient from '../../api/axiosClient';

const API_BASE = '/v1';
const SD_API_BASE = '/sdapi/v1';
const ADMIN_API_BASE = '/admin';

// Generate web search tool with current date for accurate queries
export const getWebSearchTool = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('vi-VN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    return {
        type: 'function',
        function: {
            name: 'web_search',
            description: `Search the web for current information. Today's date is ${dateStr}. Use this when you need up-to-date information, news, real-time data, or facts. Include today's date in your search query when searching for current prices, weather, or daily information. For example, use "giá vàng hôm nay ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}" instead of just "giá vàng hôm nay".`,
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: `The search query. Include today's date (${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}) when searching for current/daily information.`
                    }
                },
                required: ['query']
            }
        }
    };
};

// Legacy export for backward compatibility
export const WEB_SEARCH_TOOL = getWebSearchTool();

// Execute web search via backend API
export const webSearch = async (query) => {
    const response = await axiosClient.post(`${ADMIN_API_BASE}/web-search`, { query, maxResults: 5 });
    return response.data;
};

// Format search results for AI context
export const formatSearchResults = (results) => {
    if (!results || results.length === 0) {
        return 'No search results found.';
    }
    return results.map((r, i) => 
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`
    ).join('\n\n');
};

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
        const requestBody = {
            model,
            messages,
            stream: true,
            ...params
        };
        
        // Debug: log if tools are being sent
        if (requestBody.tools) {
            console.log('[WebSearch] Sending request with tools:', requestBody.tools);
        }

        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(requestBody)
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

// Retry configuration for image generation
const IMAGE_RETRY_CONFIG = {
    maxRetries: 5,
    delayMs: 3000, // 3 seconds between retries
};

// Helper: sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: retry wrapper for image generation
const withRetry = async (fn, fnName) => {
    let lastError;
    for (let attempt = 1; attempt <= IMAGE_RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response?.status;

            // Only retry on 429 (rate limit) errors
            if (status === 429 && attempt < IMAGE_RETRY_CONFIG.maxRetries) {
                console.warn(`[ImageGen] ${fnName} - 429 Rate Limited. Retry ${attempt}/${IMAGE_RETRY_CONFIG.maxRetries} in ${IMAGE_RETRY_CONFIG.delayMs}ms...`);
                await sleep(IMAGE_RETRY_CONFIG.delayMs);
                continue;
            }

            // For other errors or max retries reached, throw immediately
            throw error;
        }
    }
    throw lastError;
};

// Text to image generation (with retry)
export const generateImage = async (prompt, model = 'gemini-3-pro-image') => {
    return withRetry(async () => {
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
            throw error; // Re-throw for retry handler
        }
    }, 'Text-to-Image').catch(error => {
        throw new Error(
            error.response?.data?.error ||
            `Image generation failed (${error.response?.status || 'Network Error'})`
        );
    });
};

// Image to image transformation (with retry)
export const transformImage = async (prompt, initImages, model = 'gemini-3-pro-image') => {
    return withRetry(async () => {
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
            throw error; // Re-throw for retry handler
        }
    }, 'Image-to-Image').catch(error => {
        throw new Error(
            error.response?.data?.error ||
            `Image transformation failed (${error.response?.status || 'Network Error'})`
        );
    });
};

// System prompts for prompt improvement
const CHAT_IMPROVE_SYSTEM_PROMPT = `You are an expert prompt engineer. Your task is to improve user prompts to make them clearer, more specific, and more effective.

Guidelines:
- Clarify the intent and add specific details
- Structure the request logically
- Add context where helpful
- Keep the same language as the original prompt
- Make the prompt actionable and focused
- Don't add unnecessary complexity

Respond ONLY with the improved prompt, nothing else. No explanations, no quotation marks, just the improved prompt text.`;

const IMAGE_IMPROVE_SYSTEM_PROMPT = `You are an expert image prompt engineer specializing in AI image generation. Your task is to enhance image prompts for maximum visual impact.

Guidelines:
- Add detailed visual descriptions (lighting, composition, perspective)
- Specify art style, medium, and technique
- Include subject details (pose, expression, textures)
- Describe background, atmosphere, and mood
- Add quality boosters (4K, highly detailed, professional)
- Keep the same language as the original prompt

Respond ONLY with the improved prompt, nothing else. No explanations, no quotation marks, just the improved image prompt.`;

// Fixed model for prompt improvement
const IMPROVE_MODEL = 'gemini-3-flash';

// Improve text chat prompt using gemini-3-flash
export const improveChatPrompt = async (prompt) => {
    // Merge system prompt into user message for better model compatibility
    const fullPrompt = `${CHAT_IMPROVE_SYSTEM_PROMPT}

Now improve this prompt:

${prompt}`;

    const improvedResponse = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
            model: IMPROVE_MODEL,
            messages: [
                { role: 'user', content: fullPrompt }
            ],
            stream: false
        })
    });

    if (!improvedResponse.ok) {
        const errorData = await improvedResponse.json().catch(() => ({}));
        console.error('Improve prompt error:', errorData);
        throw new Error(`HTTP error! status: ${improvedResponse.status}`);
    }

    const data = await improvedResponse.json();
    return data.choices?.[0]?.message?.content?.trim() || prompt;
};

// Improve image generation prompt using gemini-3-flash
export const improveImagePrompt = async (prompt) => {
    // Merge system prompt into user message for better model compatibility
    const fullPrompt = `${IMAGE_IMPROVE_SYSTEM_PROMPT}

Now improve this image prompt:

${prompt}`;

    const improvedResponse = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
            model: IMPROVE_MODEL,
            messages: [
                { role: 'user', content: fullPrompt }
            ],
            stream: false
        })
    });

    if (!improvedResponse.ok) {
        const errorData = await improvedResponse.json().catch(() => ({}));
        console.error('Improve image prompt error:', errorData);
        throw new Error(`HTTP error! status: ${improvedResponse.status}`);
    }

    const data = await improvedResponse.json();
    return data.choices?.[0]?.message?.content?.trim() || prompt;
};
