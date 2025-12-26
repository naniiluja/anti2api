/**
 * Request Logger - Stores API call history
 */

const MAX_HISTORY_SIZE = 100;
const requestHistory = [];

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

export default {
  logRequest,
  getHistory,
  clearHistory,
  getStats
};
