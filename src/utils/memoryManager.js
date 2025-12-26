/**
 * Intelligent Memory Manager
 * Uses tiered strategy to dynamically adjust cache and object pools based on memory pressure
 * Thresholds are dynamically calculated based on user-configured memoryThreshold (MB)
 * @module utils/memoryManager
 */

import logger from './logger.js';
import { GC_COOLDOWN } from '../constants/index.js';

/**
 * Memory pressure level enum
 * @enum {string}
 */
const MemoryPressure = {
  LOW: 'low',       // < 30% threshold - Normal operation
  MEDIUM: 'medium', // 30%-60% threshold - Light cleanup
  HIGH: 'high',     // 60%-100% threshold - Aggressive cleanup
  CRITICAL: 'critical' // > 100% threshold - Emergency cleanup
};

/**
 * Calculate thresholds for each level based on user-configured memory threshold
 * @param {number} thresholdMB - User-configured memory threshold (MB), i.e., high pressure threshold
 * @returns {Object} Thresholds for each level (bytes)
 */
function calculateThresholds(thresholdMB) {
  const highBytes = thresholdMB * 1024 * 1024;
  return {
    LOW: Math.floor(highBytes * 0.3),      // 30% is low pressure threshold
    MEDIUM: Math.floor(highBytes * 0.6),   // 60% is medium pressure threshold
    HIGH: highBytes,                        // 100% is high pressure threshold (user-configured value)
    TARGET: Math.floor(highBytes * 0.5)    // 50% is target memory
  };
}

// Default thresholds (100MB), will be overridden during initialization
let THRESHOLDS = calculateThresholds(100);

// Object pool max size configuration (adjusted by pressure)
const POOL_SIZES = {
  [MemoryPressure.LOW]: { chunk: 30, toolCall: 15, lineBuffer: 5 },
  [MemoryPressure.MEDIUM]: { chunk: 20, toolCall: 10, lineBuffer: 3 },
  [MemoryPressure.HIGH]: { chunk: 10, toolCall: 5, lineBuffer: 2 },
  [MemoryPressure.CRITICAL]: { chunk: 5, toolCall: 3, lineBuffer: 1 }
};

/**
 * Memory Manager class
 */
class MemoryManager {
  constructor() {
    /** @type {string} */
    this.currentPressure = MemoryPressure.LOW;
    /** @type {Set<Function>} */
    this.cleanupCallbacks = new Set();
    /** @type {number} */
    this.lastGCTime = 0;
    /** @type {number} */
    this.gcCooldown = GC_COOLDOWN;
    this.checkInterval = null;
    this.isShuttingDown = false;
    /** @type {number} User-configured memory threshold (MB) */
    this.configuredThresholdMB = 100;

    // Statistics
    this.stats = {
      gcCount: 0,
      cleanupCount: 0,
      peakMemory: 0
    };
  }

  /**
   * Set memory threshold (loaded from config)
   * @param {number} thresholdMB - Memory threshold (MB)
   */
  setThreshold(thresholdMB) {
    if (thresholdMB && thresholdMB > 0) {
      this.configuredThresholdMB = thresholdMB;
      THRESHOLDS = calculateThresholds(thresholdMB);
      logger.info(`Memory threshold set: ${thresholdMB}MB (LOW: ${Math.floor(THRESHOLDS.LOW / 1024 / 1024)}MB, MEDIUM: ${Math.floor(THRESHOLDS.MEDIUM / 1024 / 1024)}MB, HIGH: ${Math.floor(THRESHOLDS.HIGH / 1024 / 1024)}MB)`);
    }
  }

  /**
   * Get current threshold configuration
   */
  getThresholds() {
    return {
      configuredMB: this.configuredThresholdMB,
      lowMB: Math.floor(THRESHOLDS.LOW / 1024 / 1024),
      mediumMB: Math.floor(THRESHOLDS.MEDIUM / 1024 / 1024),
      highMB: Math.floor(THRESHOLDS.HIGH / 1024 / 1024),
      targetMB: Math.floor(THRESHOLDS.TARGET / 1024 / 1024)
    };
  }

  /**
   * Start memory monitoring
   * @param {number} interval - Check interval (milliseconds)
   */
  start(interval = 30000) {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.check();
      }
    }, interval);

    // First check immediately
    this.check();
    logger.info(`Memory manager started (check interval: ${interval / 1000}s)`);
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    this.isShuttingDown = true;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.cleanupCallbacks.clear();
    logger.info('Memory manager stopped');
  }

  /**
   * Register cleanup callback
   * @param {Function} callback - Cleanup function, receives pressure parameter
   */
  registerCleanup(callback) {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Unregister cleanup callback
   * @param {Function} callback
   */
  unregisterCleanup(callback) {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 10) / 10
    };
  }

  /**
   * Determine memory pressure level
   */
  getPressureLevel(heapUsed) {
    if (heapUsed < THRESHOLDS.LOW) return MemoryPressure.LOW;
    if (heapUsed < THRESHOLDS.MEDIUM) return MemoryPressure.MEDIUM;
    if (heapUsed < THRESHOLDS.HIGH) return MemoryPressure.HIGH;
    return MemoryPressure.CRITICAL;
  }

  /**
   * Get object pool size configuration for current pressure
   */
  getPoolSizes() {
    return POOL_SIZES[this.currentPressure];
  }

  /**
   * Get current pressure level
   */
  getCurrentPressure() {
    return this.currentPressure;
  }

  /**
   * Check memory and trigger corresponding cleanup
   */
  check() {
    const { heapUsed, heapUsedMB } = this.getMemoryUsage();
    const newPressure = this.getPressureLevel(heapUsed);

    // Update peak statistics
    if (heapUsed > this.stats.peakMemory) {
      this.stats.peakMemory = heapUsed;
    }

    // Log when pressure level changes
    if (newPressure !== this.currentPressure) {
      logger.info(`Memory pressure changed: ${this.currentPressure} -> ${newPressure} (${heapUsedMB}MB)`);
      this.currentPressure = newPressure;
    }

    // Execute different strategies based on pressure level
    switch (newPressure) {
      case MemoryPressure.CRITICAL:
        this.handleCriticalPressure(heapUsedMB);
        break;
      case MemoryPressure.HIGH:
        this.handleHighPressure(heapUsedMB);
        break;
      case MemoryPressure.MEDIUM:
        this.handleMediumPressure(heapUsedMB);
        break;
      // LOW pressure doesn't need special handling
    }

    return newPressure;
  }

  /**
   * Handle medium pressure
   */
  handleMediumPressure(heapUsedMB) {
    // Notify modules to reduce object pools
    this.notifyCleanup(MemoryPressure.MEDIUM);
    this.stats.cleanupCount++;
  }

  /**
   * Handle high pressure
   */
  handleHighPressure(heapUsedMB) {
    logger.info(`Memory high (${heapUsedMB}MB), performing aggressive cleanup`);
    this.notifyCleanup(MemoryPressure.HIGH);
    this.stats.cleanupCount++;

    // Try to trigger GC (with cooldown)
    this.tryGC();
  }

  /**
   * Handle critical pressure
   */
  handleCriticalPressure(heapUsedMB) {
    logger.warn(`Memory critical (${heapUsedMB}MB), performing emergency cleanup`);
    this.notifyCleanup(MemoryPressure.CRITICAL);
    this.stats.cleanupCount++;

    // Force GC (ignore cooldown)
    this.forceGC();
  }

  /**
   * Notify all registered cleanup callbacks
   */
  notifyCleanup(pressure) {
    for (const callback of this.cleanupCallbacks) {
      try {
        callback(pressure);
      } catch (error) {
        logger.error('Cleanup callback execution failed:', error.message);
      }
    }
  }

  /**
   * Try to trigger GC (with cooldown time)
   */
  tryGC() {
    const now = Date.now();
    if (now - this.lastGCTime < this.gcCooldown) {
      return false;
    }
    return this.forceGC();
  }

  /**
   * Force trigger GC
   */
  forceGC() {
    if (global.gc) {
      const before = this.getMemoryUsage().heapUsedMB;
      global.gc();
      this.lastGCTime = Date.now();
      this.stats.gcCount++;
      const after = this.getMemoryUsage().heapUsedMB;
      logger.info(`GC completed: ${before}MB -> ${after}MB (freed ${(before - after).toFixed(1)}MB)`);
      return true;
    }
    return false;
  }

  /**
   * Manually trigger check and cleanup
   */
  cleanup() {
    return this.check();
  }

  /**
   * Get statistics
   */
  getStats() {
    const memory = this.getMemoryUsage();
    return {
      ...this.stats,
      currentPressure: this.currentPressure,
      currentHeapMB: memory.heapUsedMB,
      peakMemoryMB: Math.round(this.stats.peakMemory / 1024 / 1024 * 10) / 10,
      poolSizes: this.getPoolSizes(),
      thresholds: this.getThresholds()
    };
  }
}

// Singleton export
const memoryManager = new MemoryManager();
export default memoryManager;

// Unified wrapper for registering cleanup callback, for consistent style across modules
export function registerMemoryPoolCleanup(pool, getMaxSize) {
  memoryManager.registerCleanup(() => {
    const maxSize = getMaxSize();
    while (pool.length > maxSize) {
      pool.pop();
    }
  });
}
export { MemoryPressure, THRESHOLDS };