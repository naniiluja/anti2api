// Claude format conversion utility
import config from '../../config/config.js';
import { convertClaudeToolsToAntigravity } from '../toolConverter.js';
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
  mergeSystemInstruction,
  modelMapping,
  isEnableThinking,
  generateGenerationConfig
} from './common.js';

/**
 * Extract images from Claude message content
 * @param {string|Array} content - Claude format message content
 * @returns {Object} Extracted content { text, images }
 */
function extractImagesFromClaudeContent(content) {
  const result = { text: '', images: [] };
  if (typeof content === 'string') {
    result.text = content;
    return result;
  }
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text') {
        result.text += item.text || '';
      } else if (item.type === 'image') {
        const source = item.source;
        if (source && source.type === 'base64' && source.data) {
          result.images.push({
            inlineData: {
              mimeType: source.media_type || 'image/png',
              data: source.data
            }
          });
        }
      }
    }
  }
  return result;
}

/**
 * Handle assistant messages in Claude format
 * @param {Object} message - Claude format message
 * @param {Array} antigravityMessages - Target message array
 * @param {boolean} enableThinking - Whether thinking is enabled
 * @param {string} actualModelName - Actual model name
 * @param {string} sessionId - Session ID
 */
function handleClaudeAssistantMessage(message, antigravityMessages, enableThinking, actualModelName, sessionId) {
  const content = message.content;
  const { reasoningSignature, toolSignature } = getSignatureContext(sessionId, actualModelName);

  let textContent = '';
  const toolCalls = [];

  if (typeof content === 'string') {
    textContent = content;
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text') {
        textContent += item.text || '';
      } else if (item.type === 'tool_use') {
        const safeName = processToolName(item.name, sessionId, actualModelName);
        const signature = enableThinking ? toolSignature : null;
        toolCalls.push(createFunctionCallPart(item.id, safeName, JSON.stringify(item.input || {}), signature));
      }
    }
  }

  const hasContent = textContent && textContent.trim() !== '';
  const parts = [];

  if (enableThinking) {
    parts.push(createThoughtPart(' '));
  }
  if (hasContent) parts.push({ text: textContent.trimEnd(), thoughtSignature: reasoningSignature });
  if (!enableThinking && parts[0]) delete parts[0].thoughtSignature;

  pushModelMessage({ parts, toolCalls, hasContent }, antigravityMessages);
}

/**
 * Handle tool result messages in Claude format
 * @param {Object} message - Claude format message
 * @param {Array} antigravityMessages - Target message array
 */
function handleClaudeToolResult(message, antigravityMessages) {
  const content = message.content;
  if (!Array.isArray(content)) return;

  for (const item of content) {
    if (item.type !== 'tool_result') continue;

    const toolUseId = item.tool_use_id;
    const functionName = findFunctionNameById(toolUseId, antigravityMessages);

    let resultContent = '';
    if (typeof item.content === 'string') {
      resultContent = item.content;
    } else if (Array.isArray(item.content)) {
      resultContent = item.content.filter(c => c.type === 'text').map(c => c.text).join('');
    }

    pushFunctionResponse(toolUseId, functionName, resultContent, antigravityMessages);
  }
}

/**
 * Convert Claude messages to Antigravity format
 * @param {Array} claudeMessages - Claude format messages
 * @param {boolean} enableThinking - Whether thinking is enabled
 * @param {string} actualModelName - Actual model name
 * @param {string} sessionId - Session ID
 * @returns {Array} Antigravity format message array
 */
function claudeMessageToAntigravity(claudeMessages, enableThinking, actualModelName, sessionId) {
  const antigravityMessages = [];
  for (const message of claudeMessages) {
    if (message.role === 'user') {
      const content = message.content;
      if (Array.isArray(content) && content.some(item => item.type === 'tool_result')) {
        handleClaudeToolResult(message, antigravityMessages);
      } else {
        const extracted = extractImagesFromClaudeContent(content);
        pushUserMessage(extracted, antigravityMessages);
      }
    } else if (message.role === 'assistant') {
      handleClaudeAssistantMessage(message, antigravityMessages, enableThinking, actualModelName, sessionId);
    }
  }
  return antigravityMessages;
}

/**
 * Generate request body for Claude format
 * @param {Array} claudeMessages - Claude format messages
 * @param {string} modelName - User requested model name
 * @param {Object} parameters - Generation parameters
 * @param {Array} claudeTools - Claude format tool definitions
 * @param {string} systemPrompt - System prompt
 * @param {Object} token - Token object
 * @returns {Object} Generated request body
 */
export function generateClaudeRequestBody(claudeMessages, modelName, parameters, claudeTools, systemPrompt, token) {
  // IMPORTANT: Map model first, then check thinking based on mapped model
  const actualModelName = modelMapping(modelName);
  // Prioritize thinking_budget from request (Claude API thinking parameter) over model name check
  const enableThinking = (parameters.thinking_budget !== undefined && parameters.thinking_budget > 0) || isEnableThinking(actualModelName);
  const mergedSystem = mergeSystemInstruction(config.systemInstruction || '', systemPrompt);

  return buildRequestBody({
    contents: claudeMessageToAntigravity(claudeMessages, enableThinking, actualModelName, token.sessionId),
    tools: convertClaudeToolsToAntigravity(claudeTools, token.sessionId, actualModelName),
    generationConfig: generateGenerationConfig(parameters, enableThinking, actualModelName),
    sessionId: token.sessionId,
    systemInstruction: mergedSystem
  }, token, actualModelName);
}
