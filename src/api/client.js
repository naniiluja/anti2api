import tokenManager from '../auth/token_manager.js';
import config from '../config/config.js';
import AntigravityRequester from '../AntigravityRequester.js';
import { saveBase64Image } from '../utils/imageStorage.js';
import logger from '../utils/logger.js';
import memoryManager, { MemoryPressure } from '../utils/memoryManager.js';
import { httpRequest, httpStreamRequest } from '../utils/httpClient.js';
import { MODEL_LIST_CACHE_TTL } from '../constants/index.js';
import { createApiError } from '../utils/errors.js';
import {
  getLineBuffer,
  releaseLineBuffer,
  parseAndEmitStreamChunk,
  convertToToolCall,
  registerStreamMemoryCleanup
} from './stream_parser.js';
import { setReasoningSignature, setToolSignature } from '../utils/thoughtSignatureCache.js';

// Request client: prefer AntigravityRequester, fallback to axios on failure
let requester = null;
let useAxios = false;

// ==================== Model list cache (smart management) ====================
// Cache expiration dynamically adjusted based on memory pressure
const getModelCacheTTL = () => {
  const baseTTL = config.cache?.modelListTTL || MODEL_LIST_CACHE_TTL;
  const pressure = memoryManager.currentPressure;
  // Shorten cache time under high pressure
  if (pressure === MemoryPressure.CRITICAL) return Math.min(baseTTL, 5 * 60 * 1000);
  if (pressure === MemoryPressure.HIGH) return Math.min(baseTTL, 15 * 60 * 1000);
  return baseTTL;
};

let modelListCache = null;
let modelListCacheTime = 0;

// Default model list (used when API request fails)
const DEFAULT_MODELS = [
  'claude-opus-4-5',
  'claude-opus-4-5-thinking',
  'claude-sonnet-4-5-thinking',
  'claude-sonnet-4-5',
  'gemini-3-pro-high',
  'gemini-2.5-flash-lite',
  'gemini-3-pro-image',
  'gemini-3-pro-image-4K',
  'gemini-3-pro-image-2K',
  'gemini-2.5-flash-thinking',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-pro-low',
  'chat_20706',
  'rev19-uic3-1p',
  'gpt-oss-120b-medium',
  'chat_23310'
];

// Generate default model list response
function getDefaultModelList() {
  const created = Math.floor(Date.now() / 1000);
  return {
    object: 'list',
    data: DEFAULT_MODELS.map(id => ({
      id,
      object: 'model',
      created,
      owned_by: 'google'
    }))
  };
}

if (config.useNativeAxios === true) {
  useAxios = true;
} else {
  try {
    requester = new AntigravityRequester();
  } catch (error) {
    logger.warn('AntigravityRequester initialization failed, falling back to axios:', error.message);
    useAxios = true;
  }
}

// Register object pool and model cache memory cleanup callbacks
function registerMemoryCleanup() {
  // Streaming parser module manages its own object pool size
  registerStreamMemoryCleanup();

  memoryManager.registerCleanup((pressure) => {
    // Clear model cache under high or critical pressure
    if (pressure === MemoryPressure.HIGH || pressure === MemoryPressure.CRITICAL) {
      const ttl = getModelCacheTTL();
      const now = Date.now();
      if (modelListCache && (now - modelListCacheTime) > ttl) {
        modelListCache = null;
        modelListCacheTime = 0;
        logger.info('Cleared expired model list cache');
      }
    }

    if (pressure === MemoryPressure.CRITICAL && modelListCache) {
      modelListCache = null;
      modelListCacheTime = 0;
      logger.info('Emergency cleared model list cache');
    }
  });
}

// Register cleanup callbacks on initialization
registerMemoryCleanup();

// ==================== Helper functions ====================

function buildHeaders(token) {
  return {
    'Host': config.api.host,
    'User-Agent': config.api.userAgent,
    'Authorization': `Bearer ${token.access_token}`,
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip'
  };
}

function buildRequesterConfig(headers, body = null) {
  const reqConfig = {
    method: 'POST',
    headers,
    timeout_ms: config.timeout,
    proxy: config.proxy
  };
  if (body !== null) reqConfig.body = JSON.stringify(body);
  return reqConfig;
}


// Unified error handling
async function handleApiError(error, token) {
  const status = error.response?.status || error.status || error.statusCode || 500;
  let errorBody = error.message;

  if (error.response?.data?.readable) {
    const chunks = [];
    for await (const chunk of error.response.data) {
      chunks.push(chunk);
    }
    errorBody = Buffer.concat(chunks).toString();
  } else if (typeof error.response?.data === 'object') {
    errorBody = JSON.stringify(error.response.data, null, 2);
  } else if (error.response?.data) {
    errorBody = error.response.data;
  }

  if (status === 403) {
    if (JSON.stringify(errorBody).includes("The caller does not")) {
      throw createApiError(`Exceeded model max context. Error details: ${errorBody}`, status, errorBody);
    }
    tokenManager.disableCurrentToken(token);
    throw createApiError(`This account has no usage permission, auto-disabled. Error details: ${errorBody}`, status, errorBody);
  }

  throw createApiError(`API request failed (${status}): ${errorBody}`, status, errorBody);
}


// ==================== Export functions ====================

export async function generateAssistantResponse(requestBody, token, callback) {

  const headers = buildHeaders(token);
  // Temporarily cache thought chain signature in state for streaming multi-chunk reuse, carrying session and model info for global cache
  const state = {
    toolCalls: [],
    reasoningSignature: null,
    sessionId: requestBody.request?.sessionId,
    model: requestBody.model
  };
  const lineBuffer = getLineBuffer(); // Get from object pool

  const processChunk = (chunk) => {
    const lines = lineBuffer.append(chunk);
    for (let i = 0; i < lines.length; i++) {
      parseAndEmitStreamChunk(lines[i], state, callback);
    }
  };

  try {
    if (useAxios) {
      const response = await httpStreamRequest({
        method: 'POST',
        url: config.api.url,
        headers,
        data: requestBody
      });

      // Use Buffer for direct processing, avoid toString memory allocation
      response.data.on('data', chunk => {
        processChunk(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      });

      await new Promise((resolve, reject) => {
        response.data.on('end', () => {
          releaseLineBuffer(lineBuffer); // Return to object pool
          resolve();
        });
        response.data.on('error', reject);
      });
    } else {
      const streamResponse = requester.antigravity_fetchStream(config.api.url, buildRequesterConfig(headers, requestBody));
      let errorBody = '';
      let statusCode = null;

      await new Promise((resolve, reject) => {
        streamResponse
          .onStart(({ status }) => { statusCode = status; })
          .onData((chunk) => {
            if (statusCode !== 200) {
              errorBody += chunk;
            } else {
              processChunk(chunk);
            }
          })
          .onEnd(() => {
            releaseLineBuffer(lineBuffer); // Return to object pool
            if (statusCode !== 200) {
              reject({ status: statusCode, message: errorBody });
            } else {
              resolve();
            }
          })
          .onError(reject);
      });
    }
  } catch (error) {
    releaseLineBuffer(lineBuffer); // Ensure return
    await handleApiError(error, token);
  }
}

// Internal tool: fetch raw model data from remote
async function fetchRawModels(headers, token) {
  try {
    if (useAxios) {
      const response = await httpRequest({
        method: 'POST',
        url: config.api.modelsUrl,
        headers,
        data: {}
      });
      return response.data;
    }
    const response = await requester.antigravity_fetch(config.api.modelsUrl, buildRequesterConfig(headers, {}));
    if (response.status !== 200) {
      const errorBody = await response.text();
      throw { status: response.status, message: errorBody };
    }
    return await response.json();
  } catch (error) {
    await handleApiError(error, token);
  }
}

export async function getAvailableModels() {
  // Check if cache is valid (dynamic TTL)
  const now = Date.now();
  const ttl = getModelCacheTTL();
  if (modelListCache && (now - modelListCacheTime) < ttl) {
    return modelListCache;
  }

  const token = await tokenManager.getToken();
  if (!token) {
    // No token available, return default model list
    logger.warn('No available token, returning default model list');
    return getDefaultModelList();
  }

  const headers = buildHeaders(token);
  const data = await fetchRawModels(headers, token);
  if (!data) {
    // Unified error handling already done in fetchRawModels, fallback to default list here
    return getDefaultModelList();
  }

  const created = Math.floor(Date.now() / 1000);
  const modelList = Object.keys(data.models || {}).map(id => ({
    id,
    object: 'model',
    created,
    owned_by: 'google'
  }));

  // Add default models (if not in API returned list)
  const existingIds = new Set(modelList.map(m => m.id));
  for (const defaultModel of DEFAULT_MODELS) {
    if (!existingIds.has(defaultModel)) {
      modelList.push({
        id: defaultModel,
        object: 'model',
        created,
        owned_by: 'google'
      });
    }
  }

  const result = {
    object: 'list',
    data: modelList
  };

  // Update cache
  modelListCache = result;
  modelListCacheTime = now;
  const currentTTL = getModelCacheTTL();
  logger.info(`Model list cached (TTL: ${currentTTL / 1000}s, model count: ${modelList.length})`);

  return result;
}

// Clear model list cache (for manual refresh)
export function clearModelListCache() {
  modelListCache = null;
  modelListCacheTime = 0;
  logger.info('Model list cache cleared');
}

export async function getModelsWithQuotas(token) {
  const headers = buildHeaders(token);
  const data = await fetchRawModels(headers, token);
  if (!data) return {};

  const quotas = {};
  Object.entries(data.models || {}).forEach(([modelId, modelData]) => {
    if (modelData.quotaInfo) {
      quotas[modelId] = {
        r: modelData.quotaInfo.remainingFraction,
        t: modelData.quotaInfo.resetTime
      };
    }
  });

  return quotas;
}

export async function generateAssistantResponseNoStream(requestBody, token) {

  const headers = buildHeaders(token);
  let data;

  try {
    if (useAxios) {
      data = (await httpRequest({
        method: 'POST',
        url: config.api.noStreamUrl,
        headers,
        data: requestBody
      })).data;
    } else {
      const response = await requester.antigravity_fetch(config.api.noStreamUrl, buildRequesterConfig(headers, requestBody));
      if (response.status !== 200) {
        const errorBody = await response.text();
        throw { status: response.status, message: errorBody };
      }
      data = await response.json();
    }
  } catch (error) {
    await handleApiError(error, token);
  }
  //console.log(JSON.stringify(data));
  // Parse response content
  const parts = data.response?.candidates?.[0]?.content?.parts || [];
  let content = '';
  let reasoningContent = '';
  let reasoningSignature = null;
  const toolCalls = [];
  const imageUrls = [];

  for (const part of parts) {
    if (part.thought === true) {
      // Chain of thought content - use DeepSeek format reasoning_content
      reasoningContent += part.text || '';
      if (part.thoughtSignature && !reasoningSignature) {
        reasoningSignature = part.thoughtSignature;
      }
    } else if (part.text !== undefined) {
      content += part.text;
    } else if (part.functionCall) {
      const toolCall = convertToToolCall(part.functionCall, requestBody.request?.sessionId, requestBody.model);
      if (part.thoughtSignature) {
        toolCall.thoughtSignature = part.thoughtSignature;
      }
      toolCalls.push(toolCall);
    } else if (part.inlineData) {
      // Save image to local and get URL
      const imageUrl = saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
      imageUrls.push(imageUrl);
    }
  }

  // Extract token usage statistics
  const usage = data.response?.usageMetadata;
  const usageData = usage ? {
    prompt_tokens: usage.promptTokenCount || 0,
    completion_tokens: usage.candidatesTokenCount || 0,
    total_tokens: usage.totalTokenCount || 0
  } : null;

  // Write new signature to global cache (by sessionId + model) for fallback in subsequent requests
  const sessionId = requestBody.request?.sessionId;
  const model = requestBody.model;
  if (sessionId && model) {
    if (reasoningSignature) {
      setReasoningSignature(sessionId, model, reasoningSignature);
    }
    // Tool signature: use first tool with thoughtSignature as cache source
    const toolSig = toolCalls.find(tc => tc.thoughtSignature)?.thoughtSignature;
    if (toolSig) {
      setToolSignature(sessionId, model, toolSig);
    }
  }

  // Image model: convert to markdown format
  if (imageUrls.length > 0) {
    let markdown = content ? content + '\n\n' : '';
    markdown += imageUrls.map(url => `![image](${url})`).join('\n\n');
    return { content: markdown, reasoningContent: reasoningContent || null, reasoningSignature, toolCalls, usage: usageData };
  }

  return { content, reasoningContent: reasoningContent || null, reasoningSignature, toolCalls, usage: usageData };
}

export async function generateImageForSD(requestBody, token) {
  const headers = buildHeaders(token);
  let data;
  //console.log(JSON.stringify(requestBody,null,2));

  try {
    if (useAxios) {
      data = (await httpRequest({
        method: 'POST',
        url: config.api.noStreamUrl,
        headers,
        data: requestBody
      })).data;
    } else {
      const response = await requester.antigravity_fetch(config.api.noStreamUrl, buildRequesterConfig(headers, requestBody));
      if (response.status !== 200) {
        const errorBody = await response.text();
        throw { status: response.status, message: errorBody };
      }
      data = await response.json();
    }
  } catch (error) {
    await handleApiError(error, token);
  }

  const parts = data.response?.candidates?.[0]?.content?.parts || [];
  const images = parts.filter(p => p.inlineData).map(p => p.inlineData.data);

  return images;
}

export function closeRequester() {
  if (requester) requester.close();
}

// Export memory cleanup registration function (for external calls)
export { registerMemoryCleanup };
