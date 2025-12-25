/**
 * Request Logger - Lưu lịch sử các lần gọi API
 */

const MAX_HISTORY_SIZE = 100;
const requestHistory = [];

/**
 * Log một request vào history
 * @param {Object} data - Thông tin request
 */
export function logRequest(data) {
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: Date.now(),
    model: data.model || 'unknown',
    tokenId: data.tokenId || null, // Short ID của token (không lưu full để bảo mật)
    status: data.status || 'unknown', // 'success', 'error'
    statusCode: data.statusCode || null,
    duration: data.duration || 0, // ms
    inputTokens: data.inputTokens || 0,
    outputTokens: data.outputTokens || 0,
    errorMessage: data.errorMessage || null,
    isStream: data.isStream || false
  };

  requestHistory.unshift(record);

  // Giữ tối đa MAX_HISTORY_SIZE records
  while (requestHistory.length > MAX_HISTORY_SIZE) {
    requestHistory.pop();
  }

  return record;
}

/**
 * Lấy toàn bộ history
 * @param {number} limit - Số lượng records tối đa
 * @returns {Array}
 */
export function getHistory(limit = MAX_HISTORY_SIZE) {
  return requestHistory.slice(0, limit);
}

/**
 * Xóa toàn bộ history
 */
export function clearHistory() {
  requestHistory.length = 0;
}

/**
 * Lấy thống kê tổng quan
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
