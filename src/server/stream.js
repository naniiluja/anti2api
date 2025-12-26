/**
 * SSE streaming response and heartbeat mechanism utility module
 * Provides unified streaming response handling, heartbeat keep-alive, 429 retry, etc.
 */

import config from '../config/config.js';
import logger from '../utils/logger.js';
import memoryManager, { registerMemoryPoolCleanup } from '../utils/memoryManager.js';
import { DEFAULT_HEARTBEAT_INTERVAL } from '../constants/index.js';

// ==================== Heartbeat mechanism (prevent CF timeout) ====================
const HEARTBEAT_INTERVAL = config.server.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
const SSE_HEARTBEAT = Buffer.from(': heartbeat\n\n');

/**
 * Create heartbeat timer
 * @param {Response} res - Express response object
 * @returns {NodeJS.Timeout} Timer
 */
export const createHeartbeat = (res) => {
  const timer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(SSE_HEARTBEAT);
    } else {
      clearInterval(timer);
    }
  }, HEARTBEAT_INTERVAL);

  // Clean up when response ends
  res.on('close', () => clearInterval(timer));
  res.on('finish', () => clearInterval(timer));

  return timer;
};

// ==================== Pre-compiled constant strings (avoid repeated creation) ====================
const SSE_PREFIX = Buffer.from('data: ');
const SSE_SUFFIX = Buffer.from('\n\n');
const SSE_DONE = Buffer.from('data: [DONE]\n\n');

/**
 * Generate response metadata
 * @returns {{id: string, created: number}}
 */
export const createResponseMeta = () => ({
  id: `chatcmpl-${Date.now()}`,
  created: Math.floor(Date.now() / 1000)
});

/**
 * Set streaming response headers
 * @param {Response} res - Express response object
 */
export const setStreamHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
};

// ==================== Object Pool (reduce GC) ====================
const chunkPool = [];

/**
 * Get chunk object from object pool
 * @returns {Object}
 */
export const getChunkObject = () => chunkPool.pop() || { choices: [{ index: 0, delta: {}, finish_reason: null }] };

/**
 * Release chunk object back to object pool
 * @param {Object} obj 
 */
export const releaseChunkObject = (obj) => {
  const maxSize = memoryManager.getPoolSizes().chunk;
  if (chunkPool.length < maxSize) chunkPool.push(obj);
};

// Register memory cleanup callback
registerMemoryPoolCleanup(chunkPool, () => memoryManager.getPoolSizes().chunk);

/**
 * Get current object pool size (for monitoring)
 * @returns {number}
 */
export const getChunkPoolSize = () => chunkPool.length;

/**
 * Clear object pool
 */
export const clearChunkPool = () => {
  chunkPool.length = 0;
};

/**
 * Zero-copy write streaming data
 * @param {Response} res - Express response object
 * @param {Object} data - Data to send
 */
export const writeStreamData = (res, data) => {
  const json = JSON.stringify(data);
  res.write(SSE_PREFIX);
  res.write(json);
  res.write(SSE_SUFFIX);
};

/**
 * End streaming response
 * @param {Response} res - Express response object
 */
export const endStream = (res, isWriteDone = true) => {
  if (res.writableEnded) return;
  if (isWriteDone) res.write(SSE_DONE);
  res.end();
};

// ==================== Generic Retry Utility (handle 429) ====================

/**
 * Executor with 429 retry
 * @param {Function} fn - Async function to execute, receives attempt parameter
 * @param {number} maxRetries - Maximum retry count
 * @param {string} loggerPrefix - Logger prefix
 * @returns {Promise<any>}
 */
export const with429Retry = async (fn, maxRetries, loggerPrefix = '') => {
  const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 0;
  let attempt = 0;
  // First execution + up to retries times
  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      // Compatible with multiple error formats: error.status, error.statusCode, error.response?.status
      const status = Number(error.status || error.statusCode || error.response?.status);
      if (status === 429 && attempt < retries) {
        const nextAttempt = attempt + 1;
        logger.warn(`${loggerPrefix}Received 429, performing retry ${nextAttempt} of ${retries}`);
        attempt = nextAttempt;
        continue;
      }
      throw error;
    }
  }
};