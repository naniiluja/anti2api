/**
 * Request Logger - Stores API call history with file persistence
 */

import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.js';
import logger from './logger.js';

const DATA_DIR = getDataDir();
const HISTORY_FILE = path.join(DATA_DIR, 'request_history.json');
const MAX_HISTORY_SIZE = 500; // Increased for persistence

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load history from file on startup
let requestHistory = [];

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      requestHistory = JSON.parse(data);
      logger.info(`Loaded ${requestHistory.length} history records from file`);
    }
  } catch (e) {
    logger.error('Failed to load request history:', e.message);
    requestHistory = [];
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(requestHistory, null, 2), 'utf-8');
  } catch (e) {
    logger.error('Failed to save request history:', e.message);
  }
}

// Load on module initialization
loadHistory();

/**
 * Log a request into history
 * @param {Object} data - Request information
 * @returns {Object} The logged record
 */
export function logRequest(data) {
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: Date.now(),
    model: data.model || 'unknown',
    tokenId: data.tokenId || null, // Short ID of the token (full ID not stored for security)
    status: data.status || 'unknown', // 'success', 'error'
    statusCode: data.statusCode || null,
    duration: data.duration || 0, // ms
    inputTokens: data.inputTokens || 0,
    outputTokens: data.outputTokens || 0,
    errorMessage: data.errorMessage || null,
    isStream: data.isStream || false
  };

  requestHistory.unshift(record);

  // Keep at most MAX_HISTORY_SIZE records
  while (requestHistory.length > MAX_HISTORY_SIZE) {
    requestHistory.pop();
  }

  // Save to file
  saveHistory();

  return record;
}

/**
 * Get the entire history
 * @param {number} limit - Maximum number of records
 * @returns {Array} List of history records
 */
export function getHistory(limit = MAX_HISTORY_SIZE) {
  return requestHistory.slice(0, limit);
}

/**
 * Clear the entire history
 */
export function clearHistory() {
  requestHistory.length = 0;
  saveHistory();
}

/**
 * Get overview statistics
 * @returns {Object} Summary statistics
 */
export function getStats() {
  const total = requestHistory.length;
  const success = requestHistory.filter(r => r.status === 'success').length;
  const error = requestHistory.filter(r => r.status === 'error').length;
  const totalDuration = requestHistory.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

  return {
    total,
    success,
    error,
    avgDuration
  };
}

/**
 * Get dashboard statistics for charts
 * @returns {Object} Dashboard data with hourly usage and model breakdown
 */
export function getDashboardStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Filter for today's records
  const todayRecords = requestHistory.filter(r => r.timestamp >= startOfDay);

  // Hourly token usage (0-23)
  const hourlyUsage = Array(24).fill(null).map((_, hour) => ({
    hour,
    inputTokens: 0,
    outputTokens: 0,
    requests: 0
  }));

  // Model breakdown
  const modelCounts = {};

  todayRecords.forEach(record => {
    // Aggregate hourly
    const recordHour = new Date(record.timestamp).getHours();
    hourlyUsage[recordHour].inputTokens += record.inputTokens || 0;
    hourlyUsage[recordHour].outputTokens += record.outputTokens || 0;
    hourlyUsage[recordHour].requests += 1;

    // Aggregate by model
    const modelName = record.model?.split('/').pop() || record.model || 'unknown';
    if (!modelCounts[modelName]) {
      modelCounts[modelName] = { calls: 0, inputTokens: 0, outputTokens: 0 };
    }
    modelCounts[modelName].calls += 1;
    modelCounts[modelName].inputTokens += record.inputTokens || 0;
    modelCounts[modelName].outputTokens += record.outputTokens || 0;
  });

  // Calculate summary stats
  const totalTokens = todayRecords.reduce((sum, r) => sum + (r.inputTokens || 0) + (r.outputTokens || 0), 0);
  const successCount = todayRecords.filter(r => r.status === 'success').length;
  const successRate = todayRecords.length > 0 ? Math.round((successCount / todayRecords.length) * 100) : 0;
  const totalDuration = todayRecords.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = todayRecords.length > 0 ? Math.round(totalDuration / todayRecords.length) : 0;

  // Convert modelCounts to array for chart
  const modelBreakdown = Object.entries(modelCounts)
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.calls - a.calls);

  return {
    date: now.toISOString().split('T')[0],
    hourlyUsage,
    modelBreakdown,
    summary: {
      totalRequests: todayRecords.length,
      totalTokens,
      successRate,
      avgDuration,
      activeModels: modelBreakdown.length
    }
  };
}

/**
 * Reload history from file (useful for external updates)
 */
export function reloadHistory() {
  loadHistory();
}

export default {
  logRequest,
  getHistory,
  clearHistory,
  getStats,
  getDashboardStats,
  reloadHistory
};
