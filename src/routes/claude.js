/**
 * Claude API routes
 * Handle /v1/messages endpoint
 */

import { Router } from 'express';
import { handleClaudeRequest } from '../server/handlers/claude.js';

const router = Router();

/**
 * POST /v1/messages
 * Handle Claude message requests
 */
router.post('/messages', (req, res) => {
  const isStream = req.body.stream === true;
  handleClaudeRequest(req, res, isStream);
});

export default router;