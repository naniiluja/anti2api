import axios from 'axios';
import { log } from '../utils/logger.js';
import { generateSessionId, generateProjectId } from '../utils/idGenerator.js';
import config, { getConfigJson } from '../config/config.js';
import { OAUTH_CONFIG } from '../constants/oauth.js';
import { buildAxiosRequestConfig } from '../utils/httpClient.js';
import {
  DEFAULT_REQUEST_COUNT_PER_TOKEN,
  TOKEN_REFRESH_BUFFER
} from '../constants/index.js';
import TokenStore from './token_store.js';
import { TokenError } from '../utils/errors.js';

// Rotation strategy enum
const RotationStrategy = {
  ROUND_ROBIN: 'round_robin',           // Load balancing: switch on each request
  QUOTA_EXHAUSTED: 'quota_exhausted',   // Switch only when quota exhausted
  REQUEST_COUNT: 'request_count'        // Switch after custom count
};

/**
 * Token Manager
 * Responsible for token storage, rotation, refresh, etc.
 */
class TokenManager {
  /**
   * @param {string} filePath - Token data file path
   */
  constructor(filePath) {
    this.store = new TokenStore(filePath);
    /** @type {Array<Object>} */
    this.tokens = [];
    /** @type {number} */
    this.currentIndex = 0;

    // Rotation strategy related - use atomic operations to avoid locks
    /** @type {string} */
    this.rotationStrategy = RotationStrategy.ROUND_ROBIN;
    /** @type {number} */
    this.requestCountPerToken = DEFAULT_REQUEST_COUNT_PER_TOKEN;
    /** @type {Map<string, number>} */
    this.tokenRequestCounts = new Map();

    // Available token index cache for quota exhausted strategy (optimized for large-scale accounts)
    /** @type {number[]} */
    this.availableQuotaTokenIndices = [];
    /** @type {number} */
    this.currentQuotaIndex = 0;

    /** @type {Promise<void>|null} */
    this._initPromise = null;
  }

  async _initialize() {
    try {
      log.info('Initializing token manager...');
      const tokenArray = await this.store.readAll();

      this.tokens = tokenArray.filter(token => token.enable !== false).map(token => ({
        ...token,
        sessionId: generateSessionId()
      }));

      this.currentIndex = 0;
      this.tokenRequestCounts.clear();
      this._rebuildAvailableQuotaTokens();

      // Load rotation strategy config
      this.loadRotationConfig();

      if (this.tokens.length === 0) {
        log.warn('⚠ No available accounts, please add using one of the following methods:');
        log.warn('  Method 1: Run npm run login command to login');
        log.warn('  Method 2: Visit the frontend management page to add accounts');
      } else {
        log.info(`Successfully loaded ${this.tokens.length} available tokens`);
        if (this.rotationStrategy === RotationStrategy.REQUEST_COUNT) {
          log.info(`Rotation strategy: ${this.rotationStrategy}, switch after ${this.requestCountPerToken} requests per token`);
        } else {
          log.info(`Rotation strategy: ${this.rotationStrategy}`);
        }

        // Concurrently refresh all expired tokens
        await this._refreshExpiredTokensConcurrently();
      }
    } catch (error) {
      log.error('Failed to initialize tokens:', error.message);
      this.tokens = [];
    }
  }

  /**
   * Concurrently refresh all expired tokens
   * @private
   */
  async _refreshExpiredTokensConcurrently() {
    const expiredTokens = this.tokens.filter(token => this.isExpired(token));
    if (expiredTokens.length === 0) {
      return;
    }

    log.info(`Found ${expiredTokens.length} expired tokens, starting concurrent refresh...`);
    const startTime = Date.now();

    const results = await Promise.allSettled(
      expiredTokens.map(token => this._refreshTokenSafe(token))
    );

    let successCount = 0;
    let failCount = 0;
    const tokensToDisable = [];

    results.forEach((result, index) => {
      const token = expiredTokens[index];
      if (result.status === 'fulfilled') {
        if (result.value === 'success') {
          successCount++;
        } else if (result.value === 'disable') {
          tokensToDisable.push(token);
          failCount++;
        }
      } else {
        failCount++;
        log.error(`...${token.access_token?.slice(-8) || 'unknown'} refresh failed:`, result.reason?.message || result.reason);
      }
    });

    // Batch disable invalid tokens
    for (const token of tokensToDisable) {
      this.disableToken(token);
    }

    const elapsed = Date.now() - startTime;
    log.info(`Concurrent refresh completed: ${successCount} succeeded, ${failCount} failed, took ${elapsed}ms`);
  }

  /**
   * Safely refresh a single token (doesn't throw exception)
   * @param {Object} token - Token object
   * @returns {Promise<'success'|'disable'|'skip'>} Refresh result
   * @private
   */
  async _refreshTokenSafe(token) {
    try {
      await this.refreshToken(token);
      return 'success';
    } catch (error) {
      if (error.statusCode === 403 || error.statusCode === 400) {
        log.warn(`...${token.access_token?.slice(-8) || 'unknown'}: Token expired, will be disabled`);
        return 'disable';
      }
      throw error;
    }
  }

  async _ensureInitialized() {
    if (!this._initPromise) {
      this._initPromise = this._initialize();
    }
    return this._initPromise;
  }

  // Load rotation strategy config
  loadRotationConfig() {
    try {
      const jsonConfig = getConfigJson();
      if (jsonConfig.rotation) {
        this.rotationStrategy = jsonConfig.rotation.strategy || RotationStrategy.ROUND_ROBIN;
        this.requestCountPerToken = jsonConfig.rotation.requestCount || 10;
      }
    } catch (error) {
      log.warn('Failed to load rotation config, using defaults:', error.message);
    }
  }

  // Update rotation strategy (hot reload)
  updateRotationConfig(strategy, requestCount) {
    if (strategy && Object.values(RotationStrategy).includes(strategy)) {
      this.rotationStrategy = strategy;
    }
    if (requestCount && requestCount > 0) {
      this.requestCountPerToken = requestCount;
    }
    // Reset counters
    this.tokenRequestCounts.clear();
    if (this.rotationStrategy === RotationStrategy.REQUEST_COUNT) {
      log.info(`Rotation strategy updated: ${this.rotationStrategy}, switch after ${this.requestCountPerToken} requests per token`);
    } else {
      log.info(`Rotation strategy updated: ${this.rotationStrategy}`);
    }
  }

  // Rebuild available token list for quota exhausted strategy
  _rebuildAvailableQuotaTokens() {
    this.availableQuotaTokenIndices = [];
    this.tokens.forEach((token, index) => {
      if (token.enable !== false && token.hasQuota !== false) {
        this.availableQuotaTokenIndices.push(index);
      }
    });

    if (this.availableQuotaTokenIndices.length === 0) {
      this.currentQuotaIndex = 0;
    } else {
      this.currentQuotaIndex = this.currentQuotaIndex % this.availableQuotaTokenIndices.length;
    }
  }

  // Remove specified index from quota exhausted strategy available list
  _removeQuotaIndex(tokenIndex) {
    const pos = this.availableQuotaTokenIndices.indexOf(tokenIndex);
    if (pos !== -1) {
      this.availableQuotaTokenIndices.splice(pos, 1);
      if (this.currentQuotaIndex >= this.availableQuotaTokenIndices.length) {
        this.currentQuotaIndex = 0;
      }
    }
  }

  async fetchProjectId(token) {
    const response = await axios(buildAxiosRequestConfig({
      method: 'POST',
      url: 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist',
      headers: {
        'Host': 'daily-cloudcode-pa.sandbox.googleapis.com',
        'User-Agent': 'antigravity/1.11.9 windows/amd64',
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip'
      },
      data: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } })
    }));
    return response.data?.cloudaicompanionProject;
  }

  /**
   * Check if token is expired
   * @param {Object} token - Token object
   * @returns {boolean} Whether expired
   */
  isExpired(token) {
    if (!token.timestamp || !token.expires_in) return true;
    const expiresAt = token.timestamp + (token.expires_in * 1000);
    return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER;
  }

  async refreshToken(token) {
    log.info('Refreshing token...');
    const body = new URLSearchParams({
      client_id: OAUTH_CONFIG.CLIENT_ID,
      client_secret: OAUTH_CONFIG.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token
    });

    try {
      const response = await axios(buildAxiosRequestConfig({
        method: 'POST',
        url: OAUTH_CONFIG.TOKEN_URL,
        headers: {
          'Host': 'oauth2.googleapis.com',
          'User-Agent': 'Go-http-client/1.1',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Encoding': 'gzip'
        },
        data: body.toString()
      }));

      token.access_token = response.data.access_token;
      token.expires_in = response.data.expires_in;
      token.timestamp = Date.now();
      this.saveToFile(token);
      return token;
    } catch (error) {
      const statusCode = error.response?.status;
      const rawBody = error.response?.data;
      const suffix = token.access_token ? token.access_token.slice(-8) : null;
      const message = typeof rawBody === 'string' ? rawBody : (rawBody?.error?.message || error.message || 'Failed to refresh token');
      throw new TokenError(message, suffix, statusCode || 500);
    }
  }

  saveToFile(tokenToUpdate = null) {
    // Keep consistent with old interface sync call style, use async write internally
    this.store.mergeActiveTokens(this.tokens, tokenToUpdate).catch((error) => {
      log.error('Failed to save accounts configuration file:', error.message);
    });
  }

  disableToken(token) {
    log.warn(`Disabling token ...${token.access_token.slice(-8)}`)
    token.enable = false;
    this.saveToFile();
    this.tokens = this.tokens.filter(t => t.refresh_token !== token.refresh_token);
    this.currentIndex = this.currentIndex % Math.max(this.tokens.length, 1);
    // Rebuild available list for quota exhausted strategy when tokens structure changes
    this._rebuildAvailableQuotaTokens();
  }

  // Atomic operation: get and increment request count
  incrementRequestCount(tokenKey) {
    const current = this.tokenRequestCounts.get(tokenKey) || 0;
    const newCount = current + 1;
    this.tokenRequestCounts.set(tokenKey, newCount);
    return newCount;
  }

  // Atomic operation: reset request count
  resetRequestCount(tokenKey) {
    this.tokenRequestCounts.set(tokenKey, 0);
  }

  // Determine if should rotate to next token
  shouldRotate(token) {
    switch (this.rotationStrategy) {
      case RotationStrategy.ROUND_ROBIN:
        // Load balancing: switch after each request
        return true;

      case RotationStrategy.QUOTA_EXHAUSTED:
        // Switch only when quota exhausted: check token's hasQuota flag
        // If hasQuota is false, quota is exhausted, need to switch
        return token.hasQuota === false;

      case RotationStrategy.REQUEST_COUNT:
        // Switch after custom count
        const tokenKey = token.refresh_token;
        const count = this.incrementRequestCount(tokenKey);
        if (count >= this.requestCountPerToken) {
          this.resetRequestCount(tokenKey);
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  // Mark token quota exhausted
  markQuotaExhausted(token) {
    token.hasQuota = false;
    this.saveToFile(token);
    log.warn(`...${token.access_token.slice(-8)}: Quota exhausted, marked as no quota`);

    if (this.rotationStrategy === RotationStrategy.QUOTA_EXHAUSTED) {
      const tokenIndex = this.tokens.findIndex(t => t.refresh_token === token.refresh_token);
      if (tokenIndex !== -1) {
        this._removeQuotaIndex(tokenIndex);
      }
      this.currentIndex = (this.currentIndex + 1) % Math.max(this.tokens.length, 1);
    }
  }

  // Restore token quota (for after quota reset)
  restoreQuota(token) {
    token.hasQuota = true;
    this.saveToFile(token);
    log.info(`...${token.access_token.slice(-8)}: Quota restored`);
  }

  /**
   * Prepare a single token (refresh + get projectId)
   * @param {Object} token - Token object
   * @returns {Promise<'ready'|'skip'|'disable'>} Processing result
   * @private
   */
  async _prepareToken(token) {
    // Refresh expired token
    if (this.isExpired(token)) {
      await this.refreshToken(token);
    }

    // Get projectId
    if (!token.projectId) {
      if (config.skipProjectIdFetch) {
        token.projectId = generateProjectId();
        this.saveToFile(token);
        log.info(`...${token.access_token.slice(-8)}: Using randomly generated projectId: ${token.projectId}`);
      } else {
        const projectId = await this.fetchProjectId(token);
        if (projectId === undefined) {
          log.warn(`...${token.access_token.slice(-8)}: Not eligible to get projectId, disabling account`);
          return 'disable';
        }
        token.projectId = projectId;
        this.saveToFile(token);
      }
    }

    return 'ready';
  }

  /**
   * Handle errors during token preparation
   * @param {Error} error - Error object
   * @param {Object} token - Token object
   * @returns {'disable'|'skip'} Processing result
   * @private
   */
  _handleTokenError(error, token) {
    const suffix = token.access_token?.slice(-8) || 'unknown';
    if (error.statusCode === 403 || error.statusCode === 400) {
      log.warn(`...${suffix}: Token expired or invalid, auto-disabled this account`);
      return 'disable';
    }
    log.error(`...${suffix} operation failed:`, error.message);
    return 'skip';
  }

  /**
   * Reset quota status for all tokens
   * @private
   */
  _resetAllQuotas() {
    log.warn('All token quotas exhausted, resetting quota status');
    this.tokens.forEach(t => {
      t.hasQuota = true;
    });
    this.saveToFile();
    this._rebuildAvailableQuotaTokens();
  }

  async getToken() {
    await this._ensureInitialized();
    if (this.tokens.length === 0) return null;

    // Special high-performance handling for quota exhausted strategy
    if (this.rotationStrategy === RotationStrategy.QUOTA_EXHAUSTED) {
      return this._getTokenForQuotaExhaustedStrategy();
    }

    return this._getTokenForDefaultStrategy();
  }

  /**
   * Token retrieval for quota exhausted strategy
   * @private
   */
  async _getTokenForQuotaExhaustedStrategy() {
    // If no available tokens currently, try to reset quotas
    if (this.availableQuotaTokenIndices.length === 0) {
      this._resetAllQuotas();
    }

    const totalAvailable = this.availableQuotaTokenIndices.length;
    if (totalAvailable === 0) {
      return null;
    }

    const startIndex = this.currentQuotaIndex % totalAvailable;

    for (let i = 0; i < totalAvailable; i++) {
      const listIndex = (startIndex + i) % totalAvailable;
      const tokenIndex = this.availableQuotaTokenIndices[listIndex];
      const token = this.tokens[tokenIndex];

      try {
        const result = await this._prepareToken(token);
        if (result === 'disable') {
          this.disableToken(token);
          this._rebuildAvailableQuotaTokens();
          if (this.tokens.length === 0 || this.availableQuotaTokenIndices.length === 0) {
            return null;
          }
          continue;
        }

        this.currentIndex = tokenIndex;
        this.currentQuotaIndex = listIndex;
        return token;
      } catch (error) {
        const action = this._handleTokenError(error, token);
        if (action === 'disable') {
          this.disableToken(token);
          this._rebuildAvailableQuotaTokens();
          if (this.tokens.length === 0 || this.availableQuotaTokenIndices.length === 0) {
            return null;
          }
        }
        // skip: continue to try next token
      }
    }

    // All available tokens unavailable, reset quota status
    this._resetAllQuotas();
    return this.tokens[0] || null;
  }

  /**
   * Token retrieval for default strategy (round_robin / request_count)
   * @private
   */
  async _getTokenForDefaultStrategy() {
    const totalTokens = this.tokens.length;
    const startIndex = this.currentIndex;

    for (let i = 0; i < totalTokens; i++) {
      const index = (startIndex + i) % totalTokens;
      const token = this.tokens[index];

      try {
        const result = await this._prepareToken(token);
        if (result === 'disable') {
          this.disableToken(token);
          if (this.tokens.length === 0) return null;
          continue;
        }

        // Update current index
        this.currentIndex = index;

        // Decide whether to switch based on strategy
        if (this.shouldRotate(token)) {
          this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
        }

        return token;
      } catch (error) {
        const action = this._handleTokenError(error, token);
        if (action === 'disable') {
          this.disableToken(token);
          if (this.tokens.length === 0) return null;
        }
        // skip: continue to try next token
      }
    }

    return null;
  }

  disableCurrentToken(token) {
    const found = this.tokens.find(t => t.access_token === token.access_token);
    if (found) {
      this.disableToken(found);
    }
  }

  // API management methods
  async reload() {
    this._initPromise = this._initialize();
    await this._initPromise;
    log.info('Token hot reloaded');
  }

  async addToken(tokenData) {
    try {
      const allTokens = await this.store.readAll();

      const newToken = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3599,
        timestamp: tokenData.timestamp || Date.now(),
        enable: tokenData.enable !== undefined ? tokenData.enable : true
      };

      if (tokenData.projectId) {
        newToken.projectId = tokenData.projectId;
      }
      if (tokenData.email) {
        newToken.email = tokenData.email;
      }
      if (tokenData.hasQuota !== undefined) {
        newToken.hasQuota = tokenData.hasQuota;
      }

      allTokens.push(newToken);
      await this.store.writeAll(allTokens);

      await this.reload();
      return { success: true, message: 'Token added successfully' };
    } catch (error) {
      log.error('Failed to add token:', error.message);
      return { success: false, message: error.message };
    }
  }

  async updateToken(refreshToken, updates) {
    try {
      const allTokens = await this.store.readAll();

      const index = allTokens.findIndex(t => t.refresh_token === refreshToken);
      if (index === -1) {
        return { success: false, message: 'Token does not exist' };
      }

      allTokens[index] = { ...allTokens[index], ...updates };
      await this.store.writeAll(allTokens);

      await this.reload();
      return { success: true, message: 'Token updated successfully' };
    } catch (error) {
      log.error('Failed to update token:', error.message);
      return { success: false, message: error.message };
    }
  }

  async deleteToken(refreshToken) {
    try {
      const allTokens = await this.store.readAll();

      const filteredTokens = allTokens.filter(t => t.refresh_token !== refreshToken);
      if (filteredTokens.length === allTokens.length) {
        return { success: false, message: 'Token does not exist' };
      }

      await this.store.writeAll(filteredTokens);

      await this.reload();
      return { success: true, message: 'Token deleted successfully' };
    } catch (error) {
      log.error('Failed to delete token:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getTokenList() {
    try {
      const allTokens = await this.store.readAll();

      return allTokens.map(token => ({
        refresh_token: token.refresh_token,
        access_token: token.access_token,
        access_token_suffix: token.access_token ? `...${token.access_token.slice(-8)}` : 'N/A',
        expires_in: token.expires_in,
        timestamp: token.timestamp,
        enable: token.enable !== false,
        projectId: token.projectId || null,
        email: token.email || null,
        hasQuota: token.hasQuota !== false
      }));
    } catch (error) {
      log.error('Failed to get token list:', error.message);
      return [];
    }
  }

  // Get current rotation config
  getRotationConfig() {
    return {
      strategy: this.rotationStrategy,
      requestCount: this.requestCountPerToken,
      currentIndex: this.currentIndex,
      tokenCounts: Object.fromEntries(this.tokenRequestCounts)
    };
  }
}

// Export strategy enum
export { RotationStrategy };

const tokenManager = new TokenManager();
export default tokenManager;
