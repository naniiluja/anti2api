// Tool conversion common module
import { sanitizeToolName, cleanParameters } from './utils.js';
import { setToolNameMapping } from './toolNameCache.js';

/**
 * Convert a single tool definition to Antigravity format functionDeclaration
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @param {Object} parameters - Tool parameters schema
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {Object} functionDeclaration object
 */
function convertSingleTool(name, description, parameters, sessionId, actualModelName) {
  const originalName = name;
  const safeName = sanitizeToolName(originalName);

  if (sessionId && actualModelName && safeName !== originalName) {
    setToolNameMapping(sessionId, actualModelName, safeName, originalName);
  }

  const rawParams = parameters || {};
  const cleanedParams = cleanParameters(rawParams) || {};
  if (cleanedParams.type === undefined) cleanedParams.type = 'object';
  if (cleanedParams.type === 'object' && cleanedParams.properties === undefined) cleanedParams.properties = {};

  return {
    name: safeName,
    description: description || '',
    parameters: cleanedParams
  };
}

/**
 * Convert OpenAI format tool list to Antigravity format
 * OpenAI format: [{ type: 'function', function: { name, description, parameters } }]
 * @param {Array} openaiTools - OpenAI format tool list
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {Array} Antigravity format tool list
 */
export function convertOpenAIToolsToAntigravity(openaiTools, sessionId, actualModelName) {
  if (!openaiTools || openaiTools.length === 0) return [];

  return openaiTools.map((tool) => {
    const func = tool.function || {};
    const declaration = convertSingleTool(
      func.name,
      func.description,
      func.parameters,
      sessionId,
      actualModelName
    );

    return {
      functionDeclarations: [declaration]
    };
  });
}

/**
 * Convert Claude format tool list to Antigravity format
 * Claude format: [{ name, description, input_schema }]
 * @param {Array} claudeTools - Claude format tool list
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {Array} Antigravity format tool list
 */
export function convertClaudeToolsToAntigravity(claudeTools, sessionId, actualModelName) {
  if (!claudeTools || claudeTools.length === 0) return [];

  return claudeTools.map((tool) => {
    const declaration = convertSingleTool(
      tool.name,
      tool.description,
      tool.input_schema,
      sessionId,
      actualModelName
    );

    return {
      functionDeclarations: [declaration]
    };
  });
}

/**
 * Convert Gemini format tool list to Antigravity format
 * Gemini format can be:
 * 1. [{ functionDeclarations: [{ name, description, parameters }] }]
 * 2. [{ name, description, parameters }]
 * @param {Array} geminiTools - Gemini format tool list
 * @param {string} sessionId - Session ID
 * @param {string} actualModelName - Actual model name
 * @returns {Array} Antigravity format tool list
 */
export function convertGeminiToolsToAntigravity(geminiTools, sessionId, actualModelName) {
  if (!geminiTools || geminiTools.length === 0) return [];

  return geminiTools.map((tool) => {
    // Format 1: Already in functionDeclarations format
    if (tool.functionDeclarations) {
      return {
        functionDeclarations: tool.functionDeclarations.map(fd =>
          convertSingleTool(fd.name, fd.description, fd.parameters, sessionId, actualModelName)
        )
      };
    }

    // Format 2: Single tool definition format
    if (tool.name) {
      const declaration = convertSingleTool(
        tool.name,
        tool.description,
        tool.parameters || tool.input_schema,
        sessionId,
        actualModelName
      );

      return {
        functionDeclarations: [declaration]
      };
    }

    // Unknown format, return as is
    return tool;
  });
}