import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../utils/paths.js';
import { FILE_CACHE_TTL } from '../constants/index.js';
import { log } from '../utils/logger.js';

/**
 * Responsible for token file reading/writing and simple caching
 * Does not care about business fields, only handles JSON array loading and saving
 */
class TokenStore {
  constructor(filePath = path.join(getDataDir(), 'accounts.json')) {
    this.filePath = filePath;
    this._cache = null;
    this._cacheTime = 0;
    this._cacheTTL = FILE_CACHE_TTL;
  }

  async _ensureFileExists() {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      // Ignore cases like directory already exists
    }

    try {
      await fs.access(this.filePath);
    } catch (e) {
      // Create empty array when file doesn't exist
      await fs.writeFile(this.filePath, '[]', 'utf8');
      log.info('✓ Created accounts configuration file');
    }
  }

  _isCacheValid() {
    if (!this._cache) return false;
    const now = Date.now();
    return (now - this._cacheTime) < this._cacheTTL;
  }

  /**
   * Read all tokens (including disabled ones), with simple memory cache
   * @returns {Promise<Array<object>>}
   */
  async readAll() {
    if (this._isCacheValid()) {
      return this._cache;
    }

    await this._ensureFileExists();
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data || '[]');
      if (!Array.isArray(parsed)) {
        log.warn('Accounts configuration file format error, reset to empty array');
        this._cache = [];
      } else {
        this._cache = parsed;
      }
    } catch (error) {
      log.error('Failed to read accounts configuration file:', error.message);
      this._cache = [];
    }
    this._cacheTime = Date.now();
    return this._cache;
  }

  /**
   * Overwrite all tokens, update cache
   * @param {Array<object>} tokens
   */
  async writeAll(tokens) {
    await this._ensureFileExists();
    const normalized = Array.isArray(tokens) ? tokens : [];
    try {
      await fs.writeFile(this.filePath, JSON.stringify(normalized, null, 2), 'utf8');
      this._cache = normalized;
      this._cacheTime = Date.now();
    } catch (error) {
      log.error('Failed to save accounts configuration file:', error.message);
      throw error;
    }
  }

  /**
   * Merge active tokens from memory back to file based on refresh_token
   * - Only match and update existing records by refresh_token
   * - Records not in activeTokens (e.g., disabled accounts) remain unchanged
   * @param {Array<object>} activeTokens - Active token list in memory (may contain sessionId)
   * @param {object|null} tokenToUpdate - If only single update needed, pass this token to reduce traversal
   */
  async mergeActiveTokens(activeTokens, tokenToUpdate = null) {
    const allTokens = [...await this.readAll()];

    const applyUpdate = (targetToken) => {
      if (!targetToken) return;
      const index = allTokens.findIndex(t => t.refresh_token === targetToken.refresh_token);
      if (index !== -1) {
        const { sessionId, ...plain } = targetToken;
        allTokens[index] = { ...allTokens[index], ...plain };
      }
    };

    if (tokenToUpdate) {
      applyUpdate(tokenToUpdate);
    } else if (Array.isArray(activeTokens) && activeTokens.length > 0) {
      for (const memToken of activeTokens) {
        applyUpdate(memToken);
      }
    }

    await this.writeAll(allTokens);
  }
}

export default TokenStore;
