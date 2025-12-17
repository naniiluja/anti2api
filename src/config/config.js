import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import log from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');
const configJsonPath = path.join(__dirname, '../../config.json');

// 确保 .env 存在
if (!fs.existsSync(envPath)) {
  const examplePath = path.join(__dirname, '../../.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    log.info('✓ 已从 .env.example 创建 .env 文件');
  }
}

// 加载 config.json
let jsonConfig = {};
if (fs.existsSync(configJsonPath)) {
  jsonConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
}

// 加载 .env
dotenv.config();

// 获取代理配置：优先使用 PROXY，其次使用系统代理环境变量
export function getProxyConfig() {
  // 优先使用显式配置的 PROXY
  if (process.env.PROXY) {
    return process.env.PROXY;
  }
  
  // 检查系统代理环境变量（按优先级）
  const systemProxy = process.env.HTTPS_PROXY ||
                      process.env.https_proxy ||
                      process.env.HTTP_PROXY ||
                      process.env.http_proxy ||
                      process.env.ALL_PROXY ||
                      process.env.all_proxy;
  
  if (systemProxy) {
    log.info(`使用系统代理: ${systemProxy}`);
  }
  
  return systemProxy || null;
}

const config = {
  server: {
    port: jsonConfig.server?.port || 8045,
    host: jsonConfig.server?.host || '0.0.0.0',
    heartbeatInterval: jsonConfig.server?.heartbeatInterval || 15000,  // 心跳间隔(ms)，防止CF超时
    memoryThreshold: jsonConfig.server?.memoryThreshold || 500  // 内存阈值(MB)，超过触发GC
  },
  cache: {
    modelListTTL: jsonConfig.cache?.modelListTTL || 60 * 60 * 1000  // 模型列表缓存时间(ms)，默认60分钟
  },
  rotation: {
    strategy: jsonConfig.rotation?.strategy || 'round_robin',  // 轮询策略: round_robin, quota_exhausted, request_count
    requestCount: jsonConfig.rotation?.requestCount || 10  // request_count策略下每个token的请求次数
  },
  imageBaseUrl: process.env.IMAGE_BASE_URL || null,
  maxImages: jsonConfig.other?.maxImages || 10,
  api: {
    url: jsonConfig.api?.url || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse',
    modelsUrl: jsonConfig.api?.modelsUrl || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
    noStreamUrl: jsonConfig.api?.noStreamUrl || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent',
    host: jsonConfig.api?.host || 'daily-cloudcode-pa.sandbox.googleapis.com',
    userAgent: jsonConfig.api?.userAgent || 'antigravity/1.11.3 windows/amd64'
  },
  defaults: {
    temperature: jsonConfig.defaults?.temperature || 1,
    top_p: jsonConfig.defaults?.topP || 0.85,
    top_k: jsonConfig.defaults?.topK || 50,
    max_tokens: jsonConfig.defaults?.maxTokens || 32000,
    thinking_budget: jsonConfig.defaults?.thinkingBudget ?? 1024
  },
  security: {
    maxRequestSize: jsonConfig.server?.maxRequestSize || '50mb',
    apiKey: process.env.API_KEY || null
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-this-in-production'
  },
  useNativeAxios: jsonConfig.other?.useNativeAxios !== false,
  timeout: jsonConfig.other?.timeout || 300000,
  // 默认 429 重试次数（统一配置，0 表示不重试，默认 3 次）
  retryTimes: Number.isFinite(jsonConfig.other?.retryTimes) ? jsonConfig.other.retryTimes : 3,
  proxy: getProxyConfig(),
  systemInstruction: process.env.SYSTEM_INSTRUCTION || '',
  skipProjectIdFetch: jsonConfig.other?.skipProjectIdFetch === true
};

log.info('✓ 配置加载成功');

export default config;

export function getConfigJson() {
  if (fs.existsSync(configJsonPath)) {
    return JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
  }
  return {};
}

export function saveConfigJson(data) {
  fs.writeFileSync(configJsonPath, JSON.stringify(data, null, 2), 'utf8');
}
