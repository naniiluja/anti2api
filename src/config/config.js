import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import log from '../utils/logger.js';
import { deepMerge } from '../utils/deepMerge.js';
import { getConfigPaths } from '../utils/paths.js';
import {
  DEFAULT_SERVER_PORT,
  DEFAULT_SERVER_HOST,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_TIMES,
  DEFAULT_MAX_REQUEST_SIZE,
  DEFAULT_MAX_IMAGES,
  MODEL_LIST_CACHE_TTL,
  DEFAULT_GENERATION_PARAMS
} from '../constants/index.js';

// Cache for generated credentials
let generatedCredentials = null;

/**
 * Generate or get admin credentials
 * If user hasn't configured, auto-generate random credentials
 */
function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  // If all configured, return directly
  if (username && password && jwtSecret) {
    return { username, password, jwtSecret };
  }

  // Generate random credentials (only once)
  if (!generatedCredentials) {
    generatedCredentials = {
      username: username || crypto.randomBytes(8).toString('hex'),
      password: password || crypto.randomBytes(16).toString('base64').replace(/[+/=]/g, ''),
      jwtSecret: jwtSecret || crypto.randomBytes(32).toString('hex')
    };

    // Display generated credentials
    if (!username || !password) {
      log.warn('═══════════════════════════════════════════════════════════');
      log.warn('⚠️  Admin username/password not configured, auto-generated random credentials:');
      log.warn(`    Username: ${generatedCredentials.username}`);
      log.warn(`    Password: ${generatedCredentials.password}`);
      log.warn('═══════════════════════════════════════════════════════════');
      log.warn('⚠️  Credentials will be regenerated on restart! Configure in .env file:');
      log.warn('    ADMIN_USERNAME=your_username');
      log.warn('    ADMIN_PASSWORD=your_password');
      log.warn('    JWT_SECRET=your_secret');
      log.warn('═══════════════════════════════════════════════════════════');
    } else if (!jwtSecret) {
      log.warn('⚠️ JWT_SECRET not configured, generated random key (login sessions will be invalid after restart)');
    }
  }

  return generatedCredentials;
}

const { envPath, configJsonPath } = getConfigPaths();

// Default system prompt
const DEFAULT_SYSTEM_INSTRUCTION = 'You are a helpful AI assistant.';

// Ensure .env exists (create with default config if missing)
if (!fs.existsSync(envPath)) {
  const defaultEnvContent = `# Sensitive configuration (only configure in .env)
# If the following three items are not configured, system will auto-generate random credentials and display on startup
# API_KEY=your-api-key
# ADMIN_USERNAME=your-username
# ADMIN_PASSWORD=your-password
# JWT_SECRET=your-jwt-secret

# Optional configuration
# PROXY=http://127.0.0.1:7890
SYSTEM_INSTRUCTION=${DEFAULT_SYSTEM_INSTRUCTION}
# IMAGE_BASE_URL=http://your-domain.com
`;
  fs.writeFileSync(envPath, defaultEnvContent, 'utf8');
  log.info('✓ Created .env file with default system prompt');
}

// Load config.json
let jsonConfig = {};
if (fs.existsSync(configJsonPath)) {
  jsonConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
}

// Load .env (specify path)
dotenv.config({ path: envPath });

// Get proxy config: prioritize PROXY, fallback to system proxy environment variables
export function getProxyConfig() {
  // Prioritize explicitly configured PROXY
  if (process.env.PROXY) {
    return process.env.PROXY;
  }

  // Check system proxy environment variables (by priority)
  const systemProxy = process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;

  if (systemProxy) {
    log.info(`Using system proxy: ${systemProxy}`);
  }

  return systemProxy || null;
}

/**
 * Build config object from JSON and environment variables
 * @param {Object} jsonConfig - JSON config object
 * @returns {Object} Complete config object
 */
export function buildConfig(jsonConfig) {
  return {
    server: {
      port: jsonConfig.server?.port || DEFAULT_SERVER_PORT,
      host: jsonConfig.server?.host || DEFAULT_SERVER_HOST,
      heartbeatInterval: jsonConfig.server?.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL,
      memoryThreshold: jsonConfig.server?.memoryThreshold || 100
    },
    cache: {
      modelListTTL: jsonConfig.cache?.modelListTTL || MODEL_LIST_CACHE_TTL
    },
    rotation: {
      strategy: jsonConfig.rotation?.strategy || 'round_robin',
      requestCount: jsonConfig.rotation?.requestCount || 10
    },
    imageBaseUrl: process.env.IMAGE_BASE_URL || null,
    maxImages: jsonConfig.other?.maxImages || DEFAULT_MAX_IMAGES,
    api: {
      url: jsonConfig.api?.url || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse',
      modelsUrl: jsonConfig.api?.modelsUrl || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
      noStreamUrl: jsonConfig.api?.noStreamUrl || 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent',
      host: jsonConfig.api?.host || 'daily-cloudcode-pa.sandbox.googleapis.com',
      userAgent: jsonConfig.api?.userAgent || 'antigravity/1.11.3 windows/amd64'
    },
    defaults: {
      temperature: jsonConfig.defaults?.temperature ?? DEFAULT_GENERATION_PARAMS.temperature,
      top_p: jsonConfig.defaults?.topP ?? DEFAULT_GENERATION_PARAMS.top_p,
      top_k: jsonConfig.defaults?.topK ?? DEFAULT_GENERATION_PARAMS.top_k,
      max_tokens: jsonConfig.defaults?.maxTokens ?? DEFAULT_GENERATION_PARAMS.max_tokens,
      thinking_budget: jsonConfig.defaults?.thinkingBudget ?? DEFAULT_GENERATION_PARAMS.thinking_budget
    },
    security: {
      maxRequestSize: jsonConfig.server?.maxRequestSize || DEFAULT_MAX_REQUEST_SIZE,
      apiKey: process.env.API_KEY || null
    },
    admin: getAdminCredentials(),
    useNativeAxios: jsonConfig.other?.useNativeAxios !== false,
    timeout: jsonConfig.other?.timeout || DEFAULT_TIMEOUT,
    retryTimes: Number.isFinite(jsonConfig.other?.retryTimes) ? jsonConfig.other.retryTimes : DEFAULT_RETRY_TIMES,
    proxy: getProxyConfig(),
    systemInstruction: process.env.SYSTEM_INSTRUCTION || '',
    skipProjectIdFetch: jsonConfig.other?.skipProjectIdFetch === true,
    useContextSystemPrompt: jsonConfig.other?.useContextSystemPrompt === true,
    passSignatureToClient: jsonConfig.other?.passSignatureToClient === true
  };
}

const config = buildConfig(jsonConfig);

log.info('✓ Configuration loaded successfully');

export default config;

export function getConfigJson() {
  if (fs.existsSync(configJsonPath)) {
    return JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
  }
  return {};
}

export function saveConfigJson(data) {
  const existing = getConfigJson();
  const merged = deepMerge(existing, data);
  fs.writeFileSync(configJsonPath, JSON.stringify(merged, null, 2), 'utf8');
}