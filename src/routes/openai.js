/**
 * OpenAI API routes
 * Handle /v1/chat/completions and /v1/models endpoints
 */

import { Router } from 'express';
import { getAvailableModels } from '../api/client.js';
import { handleOpenAIRequest } from '../server/handlers/openai.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /v1/models
 * Get available models list
 */
router.get('/models', async (req, res) => {
  try {
    const models = await getAvailableModels();
    res.json(models);
  } catch (error) {
    logger.error('Failed to get models list:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /v1/chat/completions
 * Handle chat completion requests
 */
router.post('/chat/completions', handleOpenAIRequest);

export default router;