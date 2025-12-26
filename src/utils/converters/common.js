// Converter common module
import config from '../../config/config.js';
import { generateRequestId } from '../idGenerator.js';
import { getReasoningSignature, getToolSignature } from '../thoughtSignatureCache.js';
import { setToolNameMapping } from '../toolNameCache.js';
import { getThoughtSignatureForModel, getToolSignatureForModel, sanitizeToolName, modelMapping, isEnableThinking, generateGenerationConfig } from '../utils.js';

/**
 * Get signature context
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {Object} Object containing reasoning and tool signatures
 */
export function getSignatureContext(sessionId, actualModelName) {
  const cachedReasoningSig = getReasoningSignature(sessionId, actualModelName);
  const cachedToolSig = getToolSignature(sessionId, actualModelName);

  return {
    reasoningSignature: cachedReasoningSig || getThoughtSignatureForModel(actualModelName),
    toolSignature: cachedToolSig || getToolSignatureForModel(actualModelName)
  };
}

/**
 * Add user message to antigravityMessages
 * @param {Object} extracted - Extracted content { text, images }
 * @param {Array} antigravityMessages - Target message array
 */
export function pushUserMessage(extracted, antigravityMessages) {
  antigravityMessages.push({
    role: 'user',
    parts: [{ text: extracted.text }, ...extracted.images]
  });
}

/**
 * Find function name by tool call ID
 * @param {string} toolCallId - Tool call ID
 * @param {Array} antigravityMessages - Message array
 * @returns {string} Function name
 */
export function findFunctionNameById(toolCallId, antigravityMessages) {
  for (let i = antigravityMessages.length - 1; i >= 0; i--) {
    if (antigravityMessages[i].role === 'model') {
      const parts = antigravityMessages[i].parts;
      for (const part of parts) {
        if (part.functionCall && part.functionCall.id === toolCallId) {
          return part.functionCall.name;
        }
      }
    }
  }
  return '';
}

/**
 * Add function response to antigravityMessages
 * @param {string} toolCallId - Tool call ID
 * @param {string} functionName - Function name
 * @param {string} resultContent - Response content
 * @param {Array} antigravityMessages - Target message array
 */
export function pushFunctionResponse(toolCallId, functionName, resultContent, antigravityMessages) {
  const lastMessage = antigravityMessages[antigravityMessages.length - 1];
  const functionResponse = {
    functionResponse: {
      id: toolCallId,
      name: functionName,
      response: { output: resultContent }
    }
  };

  if (lastMessage?.role === 'user' && lastMessage.parts.some(p => p.functionResponse)) {
    lastMessage.parts.push(functionResponse);
  } else {
    antigravityMessages.push({ role: 'user', parts: [functionResponse] });
  }
}

/**
 * Create thought part with signature
 * @param {string} text - Thought text
 * @param {string} signature - Signature
 * @returns {Object} Thought part
 */
export function createThoughtPart(text) {
  return { text: text || ' ', thought: true }
}

/**
 * Create function call part with signature
 * @param {string} id - Call ID
 * @param {string} name - Function name (cleaned)
 * @param {Object|string} args - Arguments
 * @param {string} signature - Signature (optional)
 * @returns {Object} Function call part
 */
export function createFunctionCallPart(id, name, args, signature = null) {
  const part = {
    functionCall: {
      id,
      name,
      args: typeof args === 'string' ? { query: args } : args
    }
  };
  if (signature) {
    part.thoughtSignature = signature;
  }
  return part;
}

/**
 * Handle tool name mapping
 * @param {string} originalName - Original name
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {string} Cleaned safe name
 */
export function processToolName(originalName, sessionId, actualModelName) {
  const safeName = sanitizeToolName(originalName);
  if (sessionId && actualModelName && safeName !== originalName) {
    setToolNameMapping(sessionId, actualModelName, safeName, originalName);
  }
  return safeName;
}

/**
 * Add model message to antigravityMessages
 * @param {Object} options - Options
 * @param {Array} options.parts - Message parts
 * @param {Array} options.toolCalls - Tool call parts
 * @param {boolean} options.hasContent - Whether has text content
 * @param {Array} antigravityMessages - Target message array
 */
export function pushModelMessage({ parts, toolCalls, hasContent }, antigravityMessages) {
  const lastMessage = antigravityMessages[antigravityMessages.length - 1];
  const hasToolCalls = toolCalls && toolCalls.length > 0;

  if (lastMessage?.role === 'model' && hasToolCalls && !hasContent) {
    lastMessage.parts.push(...toolCalls);
  } else {
    const allParts = [...parts, ...(toolCalls || [])];
    antigravityMessages.push({ role: 'model', parts: allParts });
  }
  //console.log(JSON.stringify(antigravityMessages,null,2));
}

/**
 * Build base request body
 * @param {Object} options - Options
 * @param {Array} options.contents - Message contents
 * @param {Array} options.tools - Tool list
 * @param {Object} options.generationConfig - Generation config
 * @param {string} options.sessionId - Session ID
 * @param {string} options.systemInstruction - System instruction
 * @param {Object} token - Token object
 * @param {string} actualModelName - Actual model name
 * @returns {Object} Request body
 */
export function buildRequestBody({ contents, tools, generationConfig, sessionId, systemInstruction }, token, actualModelName) {
  const requestBody = {
    project: token.projectId,
    requestId: generateRequestId(),
    request: {
      contents,
      tools: tools || [],
      toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
      generationConfig,
      sessionId
    },
    model: actualModelName,
    userAgent: 'antigravity'
  };

  if (systemInstruction) {
    requestBody.request.systemInstruction = {
      role: 'user',
      parts: [{ text: systemInstruction }]
    };
  }

  return requestBody;
}

/**
 * Merge system instructions
 * @param {string} baseSystem - Base system instruction
 * @param {string} contextSystem - Context system instruction
 * @returns {string} Merged system instruction
 */
export function mergeSystemInstruction(baseSystem, contextSystem) {
  if (!config.useContextSystemPrompt || !contextSystem) {
    return baseSystem || '';
  }

  const parts = [];
  if (baseSystem && typeof baseSystem === 'string' && baseSystem.trim()) parts.push(baseSystem.trim());
  if (contextSystem && typeof contextSystem === 'string' && contextSystem.trim()) parts.push(contextSystem.trim());
  return parts.join('\n\n');
}

// Re-export commonly used functions
export { sanitizeToolName, modelMapping, isEnableThinking, generateGenerationConfig };

// Re-export parameter normalization functions
export {
  normalizeOpenAIParameters,
  normalizeClaudeParameters,
  normalizeGeminiParameters,
  normalizeParameters,
  toGenerationConfig
} from '../parameterNormalizer.js';
