// 统一参数处理模块
// 将 OpenAI、Claude、Gemini 三种格式的参数统一转换为内部格式

import config from '../config/config.js';
import { REASONING_EFFORT_MAP } from '../constants/index.js';

/**
 * 内部统一参数格式
 * @typedef {Object} NormalizedParameters
 * @property {number} max_tokens - 最大输出 token 数
 * @property {number} temperature - 温度
 * @property {number} top_p - Top-P 采样
 * @property {number} top_k - Top-K 采样
 * @property {number|undefined} thinking_budget - 思考预算（undefined 表示使用默认值）
 */

/**
 * 从 OpenAI 格式提取参数
 * OpenAI 格式参数：
 * - max_tokens: number
 * - temperature: number
 * - top_p: number
 * - top_k: number (非标准，但支持)
 * - thinking_budget: number (扩展)
 * - reasoning_effort: 'low' | 'medium' | 'high' (扩展)
 * 
 * @param {Object} params - OpenAI 格式的参数对象
 * @returns {NormalizedParameters}
 */
export function normalizeOpenAIParameters(params = {}) {
  const normalized = {
    max_tokens: params.max_tokens ?? config.defaults.max_tokens,
    temperature: params.temperature ?? config.defaults.temperature,
    top_p: params.top_p ?? config.defaults.top_p,
    top_k: params.top_k ?? config.defaults.top_k,
  };

  // 处理思考预算
  if (params.thinking_budget !== undefined) {
    normalized.thinking_budget = params.thinking_budget;
  } else if (params.reasoning_effort !== undefined) {
    normalized.thinking_budget = REASONING_EFFORT_MAP[params.reasoning_effort];
  }

  return normalized;
}

/**
 * 从 Claude 格式提取参数
 * Claude 格式参数：
 * - max_tokens: number
 * - temperature: number
 * - top_p: number
 * - top_k: number
 * - thinking: { type: 'enabled' | 'disabled', budget_tokens?: number }
 * 
 * @param {Object} params - Claude 格式的参数对象
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

  // 处理 Claude 的 thinking 参数
  // 格式: { "type": "enabled", "budget_tokens": 10000 } 或 { "type": "disabled" }
  if (thinking && typeof thinking === 'object') {
    if (thinking.type === 'enabled' && thinking.budget_tokens !== undefined) {
      normalized.thinking_budget = thinking.budget_tokens;
    } else if (thinking.type === 'disabled') {
      // 显式禁用思考
      normalized.thinking_budget = 0;
    }
  }

  // 保留其他参数
  Object.assign(normalized, rest);

  return normalized;
}

/**
 * 从 Gemini 格式提取参数
 * Gemini 格式参数（在 generationConfig 中）：
 * - temperature: number
 * - topP: number
 * - topK: number
 * - maxOutputTokens: number
 * - thinkingConfig: { includeThoughts: boolean, thinkingBudget?: number }
 * 
 * @param {Object} generationConfig - Gemini 格式的 generationConfig 对象
 * @returns {NormalizedParameters}
 */
export function normalizeGeminiParameters(generationConfig = {}) {
  const normalized = {
    max_tokens: generationConfig.maxOutputTokens ?? config.defaults.max_tokens,
    temperature: generationConfig.temperature ?? config.defaults.temperature,
    top_p: generationConfig.topP ?? config.defaults.top_p,
    top_k: generationConfig.topK ?? config.defaults.top_k,
  };

  // 处理 Gemini 的 thinkingConfig 参数
  if (generationConfig.thinkingConfig && typeof generationConfig.thinkingConfig === 'object') {
    if (generationConfig.thinkingConfig.includeThoughts === false) {
      // 显式禁用思考
      normalized.thinking_budget = 0;
    } else if (generationConfig.thinkingConfig.thinkingBudget !== undefined) {
      normalized.thinking_budget = generationConfig.thinkingConfig.thinkingBudget;
    }
  }

  return normalized;
}

/**
 * 自动检测格式并规范化参数
 * @param {Object} params - 原始参数对象
 * @param {'openai' | 'claude' | 'gemini'} format - API 格式
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
 * 将规范化参数转换为 Gemini generationConfig 格式
 * @param {NormalizedParameters} normalized - 规范化后的参数
 * @param {boolean} enableThinking - 是否启用思考
 * @param {string} actualModelName - 实际模型名称
 * @returns {Object} Gemini generationConfig 格式
 */
export function toGenerationConfig(normalized, enableThinking, actualModelName) {
  const defaultThinkingBudget = config.defaults.thinking_budget ?? 1024;
  let thinkingBudget = 0;
  let actualEnableThinking = enableThinking;
  
  if (enableThinking) {
    if (normalized.thinking_budget !== undefined) {
      thinkingBudget = normalized.thinking_budget;
      // 如果用户显式设置 thinking_budget = 0，则禁用思考
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

  // Claude 模型在启用思考时不支持 topP
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