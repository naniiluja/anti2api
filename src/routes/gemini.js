/**
 * Gemini API routes
 * Handle /v1beta/models/* endpoints
 */

import { Router } from 'express';
import { handleGeminiModelsList, handleGeminiModelDetail, handleGeminiRequest } from '../server/handlers/gemini.js';

const router = Router();

/**
 * GET /v1beta/models
 * Get models list (Gemini format)
 */
router.get('/models', handleGeminiModelsList);

/**
 * GET /v1beta/models/:model
 * Get single model details (Gemini format)
 */
router.get('/models/:model', handleGeminiModelDetail);

/**
 * POST /v1beta/models/:model:streamGenerateContent
 * Stream generate content
 */
router.post('/models/:model\\:streamGenerateContent', (req, res) => {
  const modelName = req.params.model;
  handleGeminiRequest(req, res, modelName, true);
});

/**
 * POST /v1beta/models/:model:generateContent
 * Generate content (supports streaming via alt=sse parameter)
 */
router.post('/models/:model\\:generateContent', (req, res) => {
  const modelName = req.params.model;
  const isStream = req.query.alt === 'sse';
  handleGeminiRequest(req, res, modelName, isStream);
});

export default router;