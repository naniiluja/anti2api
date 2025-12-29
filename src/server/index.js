/**
 * Server main entry
 * Express application configuration, middleware, route mounting, server startup and shutdown
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { closeRequester } from '../api/client.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import memoryManager from '../utils/memoryManager.js';
import { getPublicDir, getRelativePath } from '../utils/paths.js';
import { MEMORY_CHECK_INTERVAL } from '../constants/index.js';
import { errorHandler } from '../utils/errors.js';
import { getChunkPoolSize, clearChunkPool } from './stream.js';

// Route modules
import adminRouter from '../routes/admin.js';
import sdRouter from '../routes/sd.js';
import openaiRouter from '../routes/openai.js';
import geminiRouter from '../routes/gemini.js';
import claudeRouter from '../routes/claude.js';
import { verifyToken } from '../auth/jwt.js';

const publicDir = getPublicDir();

logger.info(`Static file directory: ${getRelativePath(publicDir)}`);

const app = express();

// ==================== Memory Management ====================
memoryManager.setThreshold(config.server.memoryThreshold);
memoryManager.start(MEMORY_CHECK_INTERVAL);

// ==================== Base Middleware ====================
app.use(cors());
app.use(compression()); // Gzip compression for responses
app.use(express.json({ limit: config.security.maxRequestSize }));

// Static file serving
app.use('/images', express.static(path.join(publicDir, 'images')));
app.use(express.static(publicDir));

// Admin routes
app.use('/admin', adminRouter);

// Use unified error handling middleware
app.use(errorHandler);

// ==================== Request Logging Middleware ====================
app.use((req, res, next) => {
  const ignorePaths = [
    '/images', '/favicon.ico', '/.well-known',
    '/sdapi/v1/options', '/sdapi/v1/samplers', '/sdapi/v1/schedulers',
    '/sdapi/v1/upscalers', '/sdapi/v1/latent-upscale-modes',
    '/sdapi/v1/sd-vae', '/sdapi/v1/sd-modules'
  ];
  // Get full path early to avoid req.path being modified to relative path after route handling
  const fullPath = req.originalUrl.split('?')[0];
  if (!ignorePaths.some(p => fullPath.startsWith(p))) {
    const start = Date.now();
    res.on('finish', () => {
      logger.request(req.method, fullPath, res.statusCode, Date.now() - start);
    });
  }
  next();
});

// SD API routes
app.use('/sdapi/v1', sdRouter);

// ==================== API Key Validation Middleware ====================
// Validates API Key or JWT token for /v1/* and /v1beta/* routes
const validateApiAuth = (req, res, next) => {
  const apiKey = config.security?.apiKey;

  // Skip validation if no API_KEY configured
  if (!apiKey) return next();

  const authHeader = req.headers.authorization || req.headers['x-api-key'];
  const providedKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Check if it's a valid API Key
  if (providedKey === apiKey) return next();

  // Check if it's a valid JWT token (for admin users)
  if (providedKey) {
    try {
      verifyToken(providedKey);
      return next(); // Valid JWT, allow access
    } catch (e) {
      // Not a valid JWT, continue to reject
    }
  }

  logger.warn(`API Key validation failed: ${req.method} ${req.path} (Provided Key: ${providedKey ? providedKey.substring(0, 10) + '...' : 'none'})`);
  return res.status(401).json({ error: 'Invalid API Key' });
};

app.use((req, res, next) => {
  if (req.path.startsWith('/v1/')) {
    return validateApiAuth(req, res, next);
  } else if (req.path.startsWith('/v1beta/')) {
    const apiKey = config.security?.apiKey;
    if (apiKey) {
      // Check query param or header for Gemini-style API key
      const providedKey = req.query.key || req.headers['x-goog-api-key'];
      if (providedKey === apiKey) return next();

      // Also check Authorization header for JWT token
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (bearerToken) {
        try {
          verifyToken(bearerToken);
          return next(); // Valid JWT, allow access
        } catch (e) {
          // Not a valid JWT
        }
      }

      logger.warn(`API Key validation failed: ${req.method} ${req.path} (Provided Key: ${providedKey ? providedKey.substring(0, 10) + '...' : 'none'})`);
      return res.status(401).json({ error: 'Invalid API Key' });
    }
  }
  next();
});


// ==================== API Routes ====================

// Claude compatible API (must be before OpenAI for /v1/models Anthropic format)
// Handles /v1/messages and /v1/models for Claude Code CLI
app.use('/v1', claudeRouter);

// OpenAI compatible API (handles /v1/chat/completions, /v1/models as fallback)
app.use('/v1', openaiRouter);

// Gemini compatible API
app.use('/v1beta', geminiRouter);

// ==================== System Endpoints ====================

// Memory monitoring endpoint
app.get('/v1/memory', (req, res) => {
  const usage = process.memoryUsage();
  res.json({
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    pressure: memoryManager.getCurrentPressure(),
    poolSizes: memoryManager.getPoolSizes(),
    chunkPoolSize: getChunkPoolSize()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ==================== Server Startup ====================
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`Server started: ${config.server.host}:${config.server.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.server.port} is already in use`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    logger.error(`No permission to access port ${config.server.port}`);
    process.exit(1);
  } else {
    logger.error('Server startup failed:', error.message);
    process.exit(1);
  }
});

// ==================== Graceful Shutdown ====================
const shutdown = () => {
  logger.info('Shutting down server...');

  // Stop memory manager
  memoryManager.stop();
  logger.info('Memory manager stopped');

  // Close subprocess requester
  closeRequester();
  logger.info('Subprocess requester closed');

  // Clear object pools
  clearChunkPool();
  logger.info('Object pools cleared');

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // 5 second timeout for forced exit
  setTimeout(() => {
    logger.warn('Server shutdown timeout, forcing exit');
    process.exit(0);
  }, 5000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ==================== Exception Handling ====================
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error.message);
  // Don't exit immediately, let current requests complete
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise rejection:', reason);
});
