import express from 'express';
import { generateToken, authMiddleware } from '../auth/jwt.js';
import tokenManager from '../auth/token_manager.js';
import quotaManager from '../auth/quota_manager.js';
import oauthManager from '../auth/oauth_manager.js';
import config, { getConfigJson, saveConfigJson } from '../config/config.js';
import logger from '../utils/logger.js';
import { parseEnvFile, updateEnvFile } from '../utils/envParser.js';
import { reloadConfig } from '../utils/configReloader.js';
import { deepMerge } from '../utils/deepMerge.js';
import { getModelsWithQuotas } from '../api/client.js';
import { getEnvPath } from '../utils/paths.js';
import requestLogger from '../utils/requestLogger.js';
import chatSessionStorage from '../utils/chatSessionStorage.js';
import dotenv from 'dotenv';

const envPath = getEnvPath();

const router = express.Router();

// Login rate limiting - prevent brute force
const loginAttempts = new Map(); // IP -> { count, lastAttempt, blockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minute window

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown';
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt) return { allowed: true };

  // Check if blocked
  if (attempt.blockedUntil && now < attempt.blockedUntil) {
    const remainingSeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many login attempts, please try again in ${remainingSeconds} seconds`,
      remainingSeconds
    };
  }

  // Clean up expired attempt records
  if (now - attempt.lastAttempt > ATTEMPT_WINDOW) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordLoginAttempt(ip, success) {
  const now = Date.now();

  if (success) {
    // Login successful, clear record
    loginAttempts.delete(ip);
    return;
  }

  // Login failed, record attempt
  const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  attempt.count++;
  attempt.lastAttempt = now;

  // Exceeded max attempts, block
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_DURATION;
    logger.warn(`IP ${ip} temporarily blocked due to too many login failures`);
  }

  loginAttempts.set(ip, attempt);
}

// Login endpoint
router.post('/login', (req, res) => {
  const clientIP = getClientIP(req);

  // Check rate limit
  const rateCheck = checkLoginRateLimit(clientIP);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: rateCheck.message,
      retryAfter: rateCheck.remainingSeconds
    });
  }

  const { username, password } = req.body;

  // Validate input
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  // Limit input length to prevent DoS
  if (username.length > 100 || password.length > 100) {
    return res.status(400).json({ success: false, message: 'Input too long' });
  }

  if (username === config.admin.username && password === config.admin.password) {
    recordLoginAttempt(clientIP, true);
    const token = generateToken({ username, role: 'admin' });
    res.json({ success: true, token });
  } else {
    recordLoginAttempt(clientIP, false);
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// Token management API - requires JWT authentication
router.get('/tokens', authMiddleware, async (req, res) => {
  try {
    const tokens = await tokenManager.getTokenList();
    res.json({ success: true, data: tokens });
  } catch (error) {
    logger.error('Failed to get token list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tokens', authMiddleware, async (req, res) => {
  const { access_token, refresh_token, expires_in, timestamp, enable, projectId, email } = req.body;
  if (!access_token || !refresh_token) {
    return res.status(400).json({ success: false, message: 'access_token and refresh_token are required' });
  }
  const tokenData = { access_token, refresh_token, expires_in };
  if (timestamp) tokenData.timestamp = timestamp;
  if (enable !== undefined) tokenData.enable = enable;
  if (projectId) tokenData.projectId = projectId;
  if (email) tokenData.email = email;

  try {
    const result = await tokenManager.addToken(tokenData);
    res.json(result);
  } catch (error) {
    logger.error('Failed to add token:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/tokens/:refreshToken', authMiddleware, async (req, res) => {
  const { refreshToken } = req.params;
  const updates = req.body;
  try {
    const result = await tokenManager.updateToken(refreshToken, updates);
    res.json(result);
  } catch (error) {
    logger.error('Failed to update token:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/tokens/:refreshToken', authMiddleware, async (req, res) => {
  const { refreshToken } = req.params;
  try {
    const result = await tokenManager.deleteToken(refreshToken);
    res.json(result);
  } catch (error) {
    logger.error('Failed to delete token:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tokens/reload', authMiddleware, async (req, res) => {
  try {
    await tokenManager.reload();
    res.json({ success: true, message: 'Token hot reloaded' });
  } catch (error) {
    logger.error('Hot reload failed:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Refresh specified token's access_token
router.post('/tokens/:refreshToken/refresh', authMiddleware, async (req, res) => {
  const { refreshToken } = req.params;
  try {
    logger.info('Refreshing token...');
    const tokens = await tokenManager.getTokenList();
    const tokenData = tokens.find(t => t.refresh_token === refreshToken);

    if (!tokenData) {
      return res.status(404).json({ success: false, message: 'Token does not exist' });
    }

    // Call tokenManager's refresh method
    const refreshedToken = await tokenManager.refreshToken(tokenData);
    res.json({ success: true, message: 'Token refreshed successfully', data: { expires_in: refreshedToken.expires_in, timestamp: refreshedToken.timestamp } });
  } catch (error) {
    logger.error('Failed to refresh token:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/oauth/exchange', authMiddleware, async (req, res) => {
  const { code, port } = req.body;
  if (!code || !port) {
    return res.status(400).json({ success: false, message: 'code and port are required' });
  }

  try {
    const account = await oauthManager.authenticate(code, port);
    const message = account.hasQuota
      ? 'Token added successfully'
      : 'Token added successfully (this account is not eligible, auto-using random ProjectId)';
    res.json({ success: true, data: account, message, fallbackMode: !account.hasQuota });
  } catch (error) {
    logger.error('Authentication failed:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get configuration
router.get('/config', authMiddleware, (req, res) => {
  try {
    const envData = parseEnvFile(envPath);
    const jsonData = getConfigJson();
    res.json({ success: true, data: { env: envData, json: jsonData } });
  } catch (error) {
    logger.error('Failed to read configuration:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update configuration
router.put('/config', authMiddleware, (req, res) => {
  try {
    const { env: envUpdates, json: jsonUpdates } = req.body;

    if (envUpdates) updateEnvFile(envPath, envUpdates);
    if (jsonUpdates) saveConfigJson(deepMerge(getConfigJson(), jsonUpdates));

    dotenv.config({ override: true });
    reloadConfig();

    logger.info('Configuration updated and hot reloaded');
    res.json({ success: true, message: 'Configuration saved and applied (port/HOST changes require restart)' });
  } catch (error) {
    logger.error('Failed to update configuration:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get rotation strategy configuration
router.get('/rotation', authMiddleware, (req, res) => {
  try {
    const rotationConfig = tokenManager.getRotationConfig();
    res.json({ success: true, data: rotationConfig });
  } catch (error) {
    logger.error('Failed to get rotation config:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update rotation strategy configuration
router.put('/rotation', authMiddleware, (req, res) => {
  try {
    const { strategy, requestCount } = req.body;

    // Validate strategy value
    const validStrategies = ['round_robin', 'quota_exhausted', 'request_count'];
    if (strategy && !validStrategies.includes(strategy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid strategy, valid options: ${validStrategies.join(', ')}`
      });
    }

    // Update in-memory configuration
    tokenManager.updateRotationConfig(strategy, requestCount);

    // Save to config.json
    const currentConfig = getConfigJson();
    if (!currentConfig.rotation) currentConfig.rotation = {};
    if (strategy) currentConfig.rotation.strategy = strategy;
    if (requestCount) currentConfig.rotation.requestCount = requestCount;
    saveConfigJson(currentConfig);

    // Reload configuration to memory
    reloadConfig();

    logger.info(`Rotation strategy updated: ${strategy || 'unchanged'}, request count: ${requestCount || 'unchanged'}`);
    res.json({ success: true, message: 'Rotation strategy updated', data: tokenManager.getRotationConfig() });
  } catch (error) {
    logger.error('Failed to update rotation config:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get model quotas for specified token
router.get('/tokens/:refreshToken/quotas', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const tokens = await tokenManager.getTokenList();
    let tokenData = tokens.find(t => t.refresh_token === refreshToken);

    if (!tokenData) {
      return res.status(404).json({ success: false, message: 'Token does not exist' });
    }

    // Check if token is expired, refresh if so
    if (tokenManager.isExpired(tokenData)) {
      try {
        tokenData = await tokenManager.refreshToken(tokenData);
      } catch (error) {
        logger.error('Failed to refresh token:', error.message);
        // Use 400 instead of 401 to avoid frontend thinking JWT login expired
        return res.status(400).json({ success: false, message: 'Google Token expired and refresh failed, please re-login your Google account' });
      }
    }

    // First get from cache (unless force refresh)
    let quotaData = forceRefresh ? null : quotaManager.getQuota(refreshToken);

    if (!quotaData) {
      // Cache miss or force refresh, get from API
      const token = { access_token: tokenData.access_token, refresh_token: refreshToken };
      const quotas = await getModelsWithQuotas(token);
      quotaManager.updateQuota(refreshToken, quotas);
      quotaData = { lastUpdated: Date.now(), models: quotas };
    }

    // Convert time to Beijing time
    const modelsWithBeijingTime = {};
    Object.entries(quotaData.models).forEach(([modelId, quota]) => {
      modelsWithBeijingTime[modelId] = {
        remaining: quota.r,
        resetTime: quotaManager.convertToBeijingTime(quota.t),
        resetTimeRaw: quota.t
      };
    });

    res.json({
      success: true,
      data: {
        lastUpdated: quotaData.lastUpdated,
        models: modelsWithBeijingTime
      }
    });
  } catch (error) {
    logger.error('Failed to get quotas:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== API History ====================

// Get API request history
router.get('/history', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = requestLogger.getHistory(limit);
    const stats = requestLogger.getStats();
    res.json({ success: true, data: { history, stats } });
  } catch (error) {
    logger.error('Failed to get history:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add entry to history (for Playground errors)
router.post('/history', authMiddleware, (req, res) => {
  try {
    const { model, status, statusCode, duration, errorMessage, source } = req.body;

    if (!model || !status) {
      return res.status(400).json({ success: false, message: 'model and status are required' });
    }

    const record = requestLogger.logRequest({
      model,
      status,
      statusCode: statusCode || null,
      duration: duration || 0,
      errorMessage: errorMessage || null,
      tokenId: source || 'playground', // Mark source as playground
      inputTokens: 0,
      outputTokens: 0,
      isStream: false
    });

    res.json({ success: true, data: record });
  } catch (error) {
    logger.error('Failed to add history:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear history
router.delete('/history', authMiddleware, (req, res) => {
  try {
    requestLogger.clearHistory();
    logger.info('History cleared');
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    logger.error('Failed to clear history:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== Chat Sessions ====================

// Get all chat sessions
router.get('/chat-sessions', authMiddleware, (req, res) => {
  try {
    const sessions = chatSessionStorage.getChatSessions();
    res.json({ success: true, data: sessions });
  } catch (error) {
    logger.error('Failed to get chat sessions:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new chat session
router.post('/chat-sessions', authMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    const session = chatSessionStorage.createChatSession(name || 'New Chat');
    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Failed to create chat session:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a chat session by ID
router.get('/chat-sessions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const session = chatSessionStorage.getChatSession(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Failed to get chat session:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a chat session
router.put('/chat-sessions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const session = chatSessionStorage.updateChatSession(id, updates);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Failed to update chat session:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a chat session
router.delete('/chat-sessions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = chatSessionStorage.deleteChatSession(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    logger.error('Failed to delete chat session:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;