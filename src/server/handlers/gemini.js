/**
 * Gemini format handler
 * Handles /v1beta/models/* requests, supports streaming and non-streaming responses
 */

import { generateAssistantResponse, generateAssistantResponseNoStream, getAvailableModels } from '../../api/client.js';
import { generateGeminiRequestBody, prepareImageRequest } from '../../utils/utils.js';
import { buildGeminiErrorPayload } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import config from '../../config/config.js';
import tokenManager from '../../auth/token_manager.js';
import {
  setStreamHeaders,
  createHeartbeat,
  writeStreamData,
  endStream,
  with429Retry
} from '../stream.js';

/**
 * Create Gemini format response
 * @param {string|null} content - Text content
 * @param {string|null} reasoning - Chain of thought content
 * @param {string|null} reasoningSignature - Chain of thought signature
 * @param {Array|null} toolCalls - Tool calls
 * @param {string|null} finishReason - Finish reason
 * @param {Object|null} usage - Usage statistics
 * @returns {Object}
 */
export const createGeminiResponse = (content, reasoning, reasoningSignature, toolCalls, finishReason, usage) => {
  const parts = [];

  if (reasoning) {
    const thoughtPart = { text: reasoning, thought: true };
    if (reasoningSignature && config.passSignatureToClient) {
      thoughtPart.thoughtSignature = reasoningSignature;
    }
    parts.push(thoughtPart);
  }

  if (content) {
    parts.push({ text: content });
  }

  if (toolCalls && toolCalls.length > 0) {
    toolCalls.forEach(tc => {
      try {
        const functionCallPart = {
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          }
        };
        if (tc.thoughtSignature && config.passSignatureToClient) {
          functionCallPart.thoughtSignature = tc.thoughtSignature;
        }
        parts.push(functionCallPart);
      } catch (e) {
        // Ignore parse error
      }
    });
  }

  const response = {
    candidates: [{
      content: {
        parts: parts,
        role: "model"
      },
      finishReason: finishReason || "STOP",
      index: 0
    }]
  };

  if (usage) {
    response.usageMetadata = {
      promptTokenCount: usage.prompt_tokens,
      candidatesTokenCount: usage.completion_tokens,
      totalTokenCount: usage.total_tokens
    };
  }

  return response;
};

/**
 * Convert OpenAI model list to Gemini format
 * @param {Object} openaiModels - OpenAI format model list
 * @returns {Object}
 */
export const convertToGeminiModelList = (openaiModels) => {
  const models = openaiModels.data.map(model => ({
    name: `models/${model.id}`,
    version: "001",
    displayName: model.id,
    description: "Imported model",
    inputTokenLimit: 32768, // 默认值
    outputTokenLimit: 8192, // 默认值
    supportedGenerationMethods: ["generateContent", "countTokens"],
    temperature: 0.9,
    topP: 1.0,
    topK: 40
  }));
  return { models };
};

/**
 * Get Gemini format model list
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const handleGeminiModelsList = async (req, res) => {
  try {
    const openaiModels = await getAvailableModels();
    const geminiModels = convertToGeminiModelList(openaiModels);
    res.json(geminiModels);
  } catch (error) {
    logger.error('Failed to get model list:', error.message);
    res.status(500).json({ error: { code: 500, message: error.message, status: "INTERNAL" } });
  }
};

/**
 * Get single model detail (Gemini format)
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const handleGeminiModelDetail = async (req, res) => {
  try {
    const modelId = req.params.model.replace(/^models\//, '');
    const openaiModels = await getAvailableModels();
    const model = openaiModels.data.find(m => m.id === modelId);

    if (model) {
      const geminiModel = {
        name: `models/${model.id}`,
        version: "001",
        displayName: model.id,
        description: "Imported model",
        inputTokenLimit: 32768,
        outputTokenLimit: 8192,
        supportedGenerationMethods: ["generateContent", "countTokens"],
        temperature: 0.9,
        topP: 1.0,
        topK: 40
      };
      res.json(geminiModel);
    } else {
      res.status(404).json({ error: { code: 404, message: `Model ${modelId} not found`, status: "NOT_FOUND" } });
    }
  } catch (error) {
    logger.error('Failed to get model detail:', error.message);
    res.status(500).json({ error: { code: 500, message: error.message, status: "INTERNAL" } });
  }
};

/**
 * Handle Gemini format chat request
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {string} modelName - Model name
 * @param {boolean} isStream - Whether streaming response
 */
export const handleGeminiRequest = async (req, res, modelName, isStream) => {
  const maxRetries = Number(config.retryTimes || 0);
  const safeRetries = maxRetries > 0 ? Math.floor(maxRetries) : 0;

  try {
    const token = await tokenManager.getToken();
    if (!token) {
      throw new Error('No available token. Please run npm run login to get a token');
    }

    const isImageModel = modelName.includes('-image');
    const requestBody = generateGeminiRequestBody(req.body, modelName, token);

    if (isImageModel) {
      prepareImageRequest(requestBody);
    }

    if (isStream) {
      setStreamHeaders(res);
      const heartbeatTimer = createHeartbeat(res);

      try {
        if (isImageModel) {
          // Image model: get result non-streaming then return at once
          const { content, usage } = await with429Retry(
            () => generateAssistantResponseNoStream(requestBody, token),
            safeRetries,
            'gemini.stream.image '
          );
          const chunk = createGeminiResponse(content, null, null, null, 'STOP', usage);
          writeStreamData(res, chunk);
          clearInterval(heartbeatTimer);
          endStream(res, false);
          return;
        }

        let usageData = null;
        let hasToolCall = false;

        await with429Retry(
          () => generateAssistantResponse(requestBody, token, (data) => {
            if (data.type === 'usage') {
              usageData = data.usage;
            } else if (data.type === 'reasoning') {
              // Gemini thinking content
              const chunk = createGeminiResponse(null, data.reasoning_content, data.thoughtSignature, null, null, null);
              writeStreamData(res, chunk);
            } else if (data.type === 'tool_calls') {
              hasToolCall = true;
              // Gemini tool calls
              const chunk = createGeminiResponse(null, null, null, data.tool_calls, null, null);
              writeStreamData(res, chunk);
            } else {
              // Normal text
              const chunk = createGeminiResponse(data.content, null, null, null, null, null);
              writeStreamData(res, chunk);
            }
          }),
          safeRetries,
          'gemini.stream '
        );

        // Send finish chunk and usage
        const finishReason = hasToolCall ? "STOP" : "STOP"; // Gemini 工具调用也是 STOP
        const finalChunk = createGeminiResponse(null, null, null, null, finishReason, usageData);
        writeStreamData(res, finalChunk);

        clearInterval(heartbeatTimer);
        endStream(res);
      } catch (error) {
        clearInterval(heartbeatTimer);
        if (!res.writableEnded) {
          const statusCode = error.statusCode || error.status || 500;
          writeStreamData(res, buildGeminiErrorPayload(error, statusCode));
          endStream(res);
        }
        logger.error('Gemini stream request failed:', error.message);
        return;
      }
    } else {
      // Non-streaming
      req.setTimeout(0);
      res.setTimeout(0);

      const { content, reasoningContent, reasoningSignature, toolCalls, usage } = await with429Retry(
        () => generateAssistantResponseNoStream(requestBody, token),
        safeRetries,
        'gemini.no_stream '
      );

      const finishReason = toolCalls.length > 0 ? "STOP" : "STOP";
      const response = createGeminiResponse(content, reasoningContent, reasoningSignature, toolCalls, finishReason, usage);
      res.json(response);
    }
  } catch (error) {
    logger.error('Gemini request failed:', error.message);
    if (res.headersSent) return;
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json(buildGeminiErrorPayload(error, statusCode));
  }
};