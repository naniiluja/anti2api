/**
 * Unified error handling module
 * @module utils/errors
 */

/**
 * Application error base class
 */
export class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} type - Error type
   */
  constructor(message, statusCode = 500, type = 'server_error') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Upstream API error
 */
export class UpstreamApiError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string|Object} rawBody - Raw response body
   */
  constructor(message, statusCode, rawBody = null) {
    super(message, statusCode, 'upstream_api_error');
    this.name = 'UpstreamApiError';
    this.rawBody = rawBody;
    this.isUpstreamApiError = true;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  /**
   * @param {string} message - Error message
   */
  constructor(message = 'Authentication failed') {
    super(message, 401, 'authentication_error');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  /**
   * @param {string} message - Error message
   */
  constructor(message = 'Access denied') {
    super(message, 403, 'authorization_error');
    this.name = 'AuthorizationError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Validation details
   */
  constructor(message = 'Invalid request parameters', details = null) {
    super(message, 400, 'validation_error');
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} message - Error message
   */
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found');
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {number} retryAfter - Retry wait time (seconds)
   */
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429, 'rate_limit_error');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Token related error
 */
export class TokenError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} tokenSuffix - Token suffix (for logging)
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, tokenSuffix = null, statusCode = 500) {
    super(message, statusCode, 'token_error');
    this.name = 'TokenError';
    this.tokenSuffix = tokenSuffix;
  }
}

/**
 * Create upstream API error (factory function)
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string|Object} rawBody - Raw response body
 * @returns {UpstreamApiError}
 */
export function createApiError(message, status, rawBody) {
  return new UpstreamApiError(message, status, rawBody);
}

/**
 * Extract message from error object
 * @param {Error} error - Error object
 * @returns {string}
 */
function extractErrorMessage(error) {
  if (error.isUpstreamApiError && error.rawBody) {
    try {
      const raw = typeof error.rawBody === 'string' ? JSON.parse(error.rawBody) : error.rawBody;
      return raw.error?.message || raw.message || error.message;
    } catch { }
  }
  return error.message || 'Internal server error';
}

/**
 * Build OpenAI compatible error response
 * @param {Error} error - Error object
 * @param {number} statusCode - HTTP status code
 * @returns {{error: {message: string, type: string, code: number}}}
 */
export function buildOpenAIErrorPayload(error, statusCode) {
  // Handle upstream API error
  if (error.isUpstreamApiError && error.rawBody) {
    try {
      const raw = typeof error.rawBody === 'string' ? JSON.parse(error.rawBody) : error.rawBody;
      const inner = raw.error || raw;
      return {
        error: {
          message: inner.message || error.message || 'Upstream API error',
          type: inner.type || 'upstream_api_error',
          code: inner.code ?? statusCode
        }
      };
    } catch {
      return {
        error: {
          message: error.rawBody || error.message || 'Upstream API error',
          type: 'upstream_api_error',
          code: statusCode
        }
      };
    }
  }

  // Handle application error
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        type: error.type,
        code: error.statusCode
      }
    };
  }

  // Handle generic error
  return {
    error: {
      message: error.message || 'Internal server error',
      type: 'server_error',
      code: statusCode
    }
  };
}

/**
 * Build Gemini compatible error response
 * @param {Error} error - Error object
 * @param {number} statusCode - HTTP status code
 * @returns {{error: {code: number, message: string, status: string}}}
 */
export function buildGeminiErrorPayload(error, statusCode) {
  return {
    error: {
      code: statusCode,
      message: extractErrorMessage(error),
      status: "INTERNAL"
    }
  };
}

/**
 * Build Claude compatible error response
 * @param {Error} error - Error object
 * @param {number} statusCode - HTTP status code
 * @returns {{type: string, error: {type: string, message: string}}}
 */
export function buildClaudeErrorPayload(error, statusCode) {
  const errorType = statusCode === 401 ? "authentication_error" :
    statusCode === 429 ? "rate_limit_error" :
      statusCode === 400 ? "invalid_request_error" :
        "api_error";

  return {
    type: "error",
    error: {
      type: errorType,
      message: extractErrorMessage(error)
    }
  };
}

/**
 * Express error handling middleware
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 * @param {import('express').NextFunction} next - Next middleware
 */
export function errorHandler(err, req, res, next) {
  // If response already sent, pass to default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle request body too large error
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        message: 'Request body too large',
        type: 'payload_too_large',
        code: 413
      }
    });
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const errorPayload = buildOpenAIErrorPayload(err, statusCode);

  return res.status(statusCode).json(errorPayload);
}

/**
 * Async route wrapper (automatically catches async errors)
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler function
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}