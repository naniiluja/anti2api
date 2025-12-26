// Unified parameter processing module
// Convert OpenAI, Claude, Gemini format parameters to internal format

import config from '../config/config.js';
import { REASONING_EFFORT_MAP } from '../constants/index.js';

/**
 * Internal unified parameter format
 * @typedef {Object} NormalizedParameters
 * @property {number} max_tokens - Maximum output tokens
 * @property {number} temperature - Temperature
 * @property {number} top_p - Top-P sampling
 * @property {number} top_k - Top-K sampling
 * @property {number|undefined} thinking_budget - Thinking budget (undefined means use default)
 */

/**
 * Extract parameters from OpenAI format
 * OpenAI format parameters:
 * - max_tokens: number
 * - temperature: number
 * - top_p: number
 * - top_k: number (non-standard, but supported)
 * - thinking_budget: number (extension)
 * - reasoning_effort: 'low' | 'medium' | 'high' (extension)
 * 
 * @param {Object} params - OpenAI format parameter object
 * @returns {NormalizedParameters}
 */
export function normalizeOpenAIParameters(params = {}) {
  const normalized = {
    max_tokens: params.max_tokens ?? config.defaults.max_tokens,
    temperature: params.temperature ?? config.defaults.temperature,
    top_p: params.top_p ?? config.defaults.top_p,
    top_k: params.top_k ?? config.defaults.top_k,
  };

  // Handle thinking budget
  if (params.thinking_budget !== undefined) {
    normalized.thinking_budget = params.thinking_budget;
  } else if (params.reasoning_effort !== undefined) {
    normalized.thinking_budget = REASONING_EFFORT_MAP[params.reasoning_effort];
  }

  return normalized;
}

/**
 * Extract parameters from Claude format
 * Claude format parameters:
 * - max_tokens: number
 * - temperature: number
 * - top_p: number
 * - top_k: number
 * - thinking: { type: 'enabled' | 'disabled', budget_tokens?: number }
 * 
 * @param {Object} params - Claude format parameter object
 * @returns {NormalizedParameters}
 */
export function normalizeClaudeParameters(params = {}) {
  const { max_tokens, temperature, top_p, top_k, thinking, ...rest } = params;

  const normalized = {
    max_tokens: max_tokens ?? config.defaults.max_tokens,
    temperature: temperature ?? config.defaults.temperature,
    top_p: top_p ?? config.defaults.top_p,
    top_k: top_k ?? config.defaults.top_k,
  };

  // Handle Claude's thinking parameter
  // Format: { "type": "enabled", "budget_tokens": 10000 } or { "type": "disabled" }
  if (thinking && typeof thinking === 'object') {
    if (thinking.type === 'enabled' && thinking.budget_tokens !== undefined) {
      normalized.thinking_budget = thinking.budget_tokens;
    } else if (thinking.type === 'disabled') {
      // Explicitly disable thinking
      normalized.thinking_budget = 0;
    }
  }

  // Preserve other parameters
  Object.assign(normalized, rest);

  return normalized;
}

/**
 * Extract parameters from Gemini format
 * Gemini format parameters (in generationConfig):
 * - temperature: number
 * - topP: number
 * - topK: number
 * - maxOutputTokens: number
 * - thinkingConfig: { includeThoughts: boolean, thinkingBudget?: number }
 * 
 * @param {Object} generationConfig - Gemini format generationConfig object
 * @returns {NormalizedParameters}
 */
export function normalizeGeminiParameters(generationConfig = {}) {
  const normalized = {
    max_tokens: generationConfig.maxOutputTokens ?? config.defaults.max_tokens,
    temperature: generationConfig.temperature ?? config.defaults.temperature,
    top_p: generationConfig.topP ?? config.defaults.top_p,
    top_k: generationConfig.topK ?? config.defaults.top_k,
  };

  // Handle Gemini's thinkingConfig parameter
  if (generationConfig.thinkingConfig && typeof generationConfig.thinkingConfig === 'object') {
    if (generationConfig.thinkingConfig.includeThoughts === false) {
      // Explicitly disable thinking
      normalized.thinking_budget = 0;
    } else if (generationConfig.thinkingConfig.thinkingBudget !== undefined) {
      normalized.thinking_budget = generationConfig.thinkingConfig.thinkingBudget;
    }
  }

  return normalized;
}

/**
 * Auto-detect format and normalize parameters
 * @param {Object} params - Original parameter object
 * @param {'openai' | 'claude' | 'gemini'} format - API format
 * @returns {NormalizedParameters}
 */
export function normalizeParameters(params, format) {
  switch (format) {
    case 'openai':
      return normalizeOpenAIParameters(params);
    case 'claude':
      return normalizeClaudeParameters(params);
    case 'gemini':
      return normalizeGeminiParameters(params);
    default:
      return normalizeOpenAIParameters(params);
  }
}

/**
 * Convert normalized parameters to Gemini generationConfig format
 * @param {NormalizedParameters} normalized - Normalized parameters
 * @param {boolean} enableThinking - Whether to enable thinking
 * @param {string} actualModelName - Actual model name
 * @returns {Object} Gemini generationConfig format
 */
export function toGenerationConfig(normalized, enableThinking, actualModelName) {
  const defaultThinkingBudget = config.defaults.thinking_budget ?? 1024;
  let thinkingBudget = 0;
  let actualEnableThinking = enableThinking;

  if (enableThinking) {
    if (normalized.thinking_budget !== undefined) {
      thinkingBudget = normalized.thinking_budget;
      // If user explicitly sets thinking_budget = 0, disable thinking
      if (thinkingBudget === 0) {
        actualEnableThinking = false;
      }
    } else {
      thinkingBudget = defaultThinkingBudget;
    }
  }

  const generationConfig = {
    topP: normalized.top_p,
    topK: normalized.top_k,
    temperature: normalized.temperature,
    candidateCount: 1,
    maxOutputTokens: normalized.max_tokens || normalized.max_completion_tokens,
    thinkingConfig: {
      includeThoughts: actualEnableThinking,
      thinkingBudget: thinkingBudget
    }
  };

  // Claude models don't support topP when thinking is enabled
  if (actualEnableThinking && actualModelName && actualModelName.includes('claude')) {
    delete generationConfig.topP;
  }

  return generationConfig;
}

export default {
  normalizeOpenAIParameters,
  normalizeClaudeParameters,
  normalizeGeminiParameters,
  normalizeParameters,
  toGenerationConfig
};