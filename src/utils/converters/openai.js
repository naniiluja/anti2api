// OpenAI format conversion utility
import config from '../../config/config.js';
import { extractSystemInstruction } from '../utils.js';
import { convertOpenAIToolsToAntigravity } from '../toolConverter.js';
import {
  getSignatureContext,
  pushUserMessage,
  findFunctionNameById,
  pushFunctionResponse,
  createThoughtPart,
  createFunctionCallPart,
  processToolName,
  pushModelMessage,
  buildRequestBody,
  modelMapping,
  isEnableThinking,
  generateGenerationConfig
} from './common.js';

/**
 * Extract images and text from OpenAI message content
 * @param {string|Array} content - OpenAI format message content
 * @returns {Object} Extracted content { text, images }
 */
function extractImagesFromContent(content) {
  const result = { text: '', images: [] };
  if (typeof content === 'string') {
    result.text = content;
    return result;
  }
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text') {
        result.text += item.text;
      } else if (item.type === 'image_url') {
        const imageUrl = item.image_url?.url || '';
        const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          result.images.push({
            inlineData: {
              mimeType: `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}`,
              data: match[2]
            }
          });
        }
      }
    }
  }
  return result;
}

/**
 * Handle assistant messages
 * @param {Object} message - OpenAI format message
 * @param {Array} antigravityMessages - Target message array
 * @param {boolean} enableThinking - Whether thinking is enabled
 * @param {string} actualModelName - Actual model name
 * @param {string} sessionId - Session ID
 */
function handleAssistantMessage(message, antigravityMessages, enableThinking, actualModelName, sessionId) {
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasContent = message.content && message.content.trim() !== '';
  const { reasoningSignature, toolSignature } = getSignatureContext(sessionId, actualModelName);

  const toolCalls = hasToolCalls
    ? message.tool_calls.map(toolCall => {
      const safeName = processToolName(toolCall.function.name, sessionId, actualModelName);
      const signature = enableThinking ? (toolCall.thoughtSignature || toolSignature) : null;
      return createFunctionCallPart(toolCall.id, safeName, toolCall.function.arguments, signature);
    })
    : [];

  const parts = [];
  if (enableThinking) {
    const reasoningText = (typeof message.reasoning_content === 'string' && message.reasoning_content.length > 0)
      ? message.reasoning_content : ' ';
    parts.push(createThoughtPart(reasoningText));
  }
  if (hasContent) parts.push({ text: message.content.trimEnd(), thoughtSignature: message.thoughtSignature || reasoningSignature });
  if (!enableThinking && parts[0]) delete parts[0].thoughtSignature;

  pushModelMessage({ parts, toolCalls, hasContent }, antigravityMessages);
}

/**
 * Handle tool call responses
 * @param {Object} message - OpenAI format message
 * @param {Array} antigravityMessages - Target message array
 */
function handleToolCall(message, antigravityMessages) {
  const functionName = findFunctionNameById(message.tool_call_id, antigravityMessages);
  pushFunctionResponse(message.tool_call_id, functionName, message.content, antigravityMessages);
}

/**
 * Convert OpenAI messages to Antigravity format
 * @param {Array} openaiMessages - OpenAI format message array
 * @param {boolean} enableThinking - Whether thinking is enabled
 * @param {string} actualModelName - Actual model name
 * @param {string} sessionId - Session ID
 * @returns {Array} Antigravity format message array
 */
function openaiMessageToAntigravity(openaiMessages, enableThinking, actualModelName, sessionId) {
  const antigravityMessages = [];
  for (const message of openaiMessages) {
    if (message.role === 'user' || message.role === 'system') {
      const extracted = extractImagesFromContent(message.content);
      pushUserMessage(extracted, antigravityMessages);
    } else if (message.role === 'assistant') {
      handleAssistantMessage(message, antigravityMessages, enableThinking, actualModelName, sessionId);
    } else if (message.role === 'tool') {
      handleToolCall(message, antigravityMessages);
    }
  }
  return antigravityMessages;
}

/**
 * Generate request body for OpenAI format
 * @param {Array} openaiMessages - OpenAI format messages
 * @param {string} modelName - User requested model name
 * @param {Object} parameters - Generation parameters
 * @param {Array} openaiTools - OpenAI format tool definitions
 * @param {Object} token - Token object
 * @returns {Object} Generated request body
 */
export function generateRequestBody(openaiMessages, modelName, parameters, openaiTools, token) {
  const enableThinking = isEnableThinking(modelName);
  const actualModelName = modelMapping(modelName);
  const mergedSystemInstruction = extractSystemInstruction(openaiMessages);

  let filteredMessages = openaiMessages;
  let startIndex = 0;
  if (config.useContextSystemPrompt) {
    for (let i = 0; i < openaiMessages.length; i++) {
      // Separate system messages at the start
      if (openaiMessages[i].role === 'system') {
        startIndex = i + 1;
      } else {
        filteredMessages = openaiMessages.slice(startIndex);
        break;
      }
    }
  }

  return buildRequestBody({
    contents: openaiMessageToAntigravity(filteredMessages, enableThinking, actualModelName, token.sessionId),
    tools: convertOpenAIToolsToAntigravity(openaiTools, token.sessionId, actualModelName),
    generationConfig: generateGenerationConfig(parameters, enableThinking, actualModelName),
    sessionId: token.sessionId,
    systemInstruction: mergedSystemInstruction
  }, token, actualModelName);
}
