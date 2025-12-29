/**
 * Claude API routes
 * Handle /v1/messages and /v1/models endpoints for Anthropic API compatibility
 */

import { Router } from 'express';
import { handleClaudeRequest } from '../server/handlers/claude.js';
import { getAvailableModels } from '../api/client.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /v1/models
 * Return models list in Anthropic format for Claude Code CLI compatibility
 */
router.get('/models', async (req, res) => {
  try {
    const models = await getAvailableModels();
    const modelsData = models.data || [];
    
    // Convert to Anthropic format
    const anthropicModels = modelsData.map(m => ({
      id: m.id,
      created_at: new Date((m.created || Date.now() / 1000) * 1000).toISOString(),
      display_name: m.id,
      type: "model"
    }));

    res.json({
      data: anthropicModels,
      first_id: anthropicModels[0]?.id || null,
      has_more: false,
      last_id: anthropicModels[anthropicModels.length - 1]?.id || null
    });
  } catch (error) {
    logger.error('Failed to get models list:', error.message);
    res.status(500).json({ error: { type: 'api_error', message: error.message } });
  }
});

/**
 * POST /v1/messages
 * Handle Claude message requests
 */
router.post('/messages', (req, res) => {
  const isStream = req.body.stream === true;
  handleClaudeRequest(req, res, isStream);
});

export default router;