import express from 'express';
import { getAvailableModels, generateImageForSD } from '../api/client.js';
import { generateRequestBody, prepareImageRequest } from '../utils/utils.js';
import tokenManager from '../auth/token_manager.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Static data
const SD_MOCK_DATA = {
  options: {
    sd_model_checkpoint: 'gemini-3-pro-image',
    sd_vae: 'auto',
    CLIP_stop_at_last_layers: 1
  },
  samplers: [
    { name: 'Euler a', aliases: ['k_euler_a'] },
    { name: 'Euler', aliases: ['k_euler'] },
    { name: 'DPM++ 2M', aliases: ['k_dpmpp_2m'] },
    { name: 'DPM++ SDE', aliases: ['k_dpmpp_sde'] }
  ],
  schedulers: [
    { name: 'Automatic', label: 'Automatic' },
    { name: 'Uniform', label: 'Uniform' },
    { name: 'Karras', label: 'Karras' },
    { name: 'Exponential', label: 'Exponential' }
  ],
  upscalers: [
    { name: 'None', model_name: null, scale: 1 },
    { name: 'Lanczos', model_name: null, scale: 4 },
    { name: 'ESRGAN_4x', model_name: 'ESRGAN_4x', scale: 4 }
  ],
  latentUpscaleModes: [
    { name: 'Latent' },
    { name: 'Latent (antialiased)' },
    { name: 'Latent (bicubic)' },
    { name: 'Latent (nearest)' }
  ],
  vae: [
    { model_name: 'auto', filename: 'auto' },
    { model_name: 'None', filename: 'None' }
  ],
  modules: [
    { name: 'none', path: null },
    { name: 'LoRA', path: 'lora' }
  ],
  loras: [
    { name: 'example_lora_v1', alias: 'example_lora_v1', path: 'example_lora_v1.safetensors' },
    { name: 'style_lora', alias: 'style_lora', path: 'style_lora.safetensors' }
  ],
  embeddings: [
    { name: 'EasyNegative', step: 1, sd_checkpoint: null, sd_checkpoint_name: null },
    { name: 'badhandv4', step: 1, sd_checkpoint: null, sd_checkpoint_name: null }
  ],
  hypernetworks: [
    { name: 'example_hypernetwork', path: 'example_hypernetwork.pt' }
  ],
  scripts: [
    { name: 'None', is_alwayson: false, is_img2img: false },
    { name: 'X/Y/Z plot', is_alwayson: false, is_img2img: false }
  ],
  progress: {
    progress: 0,
    eta_relative: 0,
    state: { skipped: false, interrupted: false, job: '', job_count: 0, job_timestamp: '0', job_no: 0 },
    current_image: null,
    textinfo: null
  }
};

// Build image generation request body
function buildImageRequestBody(prompt, token, model = 'gemini-3-pro-image') {
  const messages = [{ role: 'user', content: prompt }];
  const requestBody = generateRequestBody(messages, model, {}, null, token);
  return prepareImageRequest(requestBody);
}

// GET routes
router.get('/sd-models', async (req, res) => {
  try {
    const models = await getAvailableModels();
    const imageModels = models.data
      .filter(m => m.id.includes('-image'))
      .map(m => ({
        title: m.id,
        model_name: m.id,
        hash: null,
        sha256: null,
        filename: m.id,
        config: null
      }));
    res.json(imageModels);
  } catch (error) {
    logger.error('Failed to get SD models:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/options', (req, res) => res.json(SD_MOCK_DATA.options));
router.get('/samplers', (req, res) => res.json(SD_MOCK_DATA.samplers));
router.get('/schedulers', (req, res) => res.json(SD_MOCK_DATA.schedulers));
router.get('/upscalers', (req, res) => res.json(SD_MOCK_DATA.upscalers));
router.get('/latent-upscale-modes', (req, res) => res.json(SD_MOCK_DATA.latentUpscaleModes));
router.get('/sd-vae', (req, res) => res.json(SD_MOCK_DATA.vae));
router.get('/sd-modules', (req, res) => res.json(SD_MOCK_DATA.modules));
router.get('/loras', (req, res) => res.json(SD_MOCK_DATA.loras));
router.get('/embeddings', (req, res) => res.json({ loaded: SD_MOCK_DATA.embeddings, skipped: {} }));
router.get('/hypernetworks', (req, res) => res.json(SD_MOCK_DATA.hypernetworks));
router.get('/scripts', (req, res) => res.json({ txt2img: SD_MOCK_DATA.scripts, img2img: SD_MOCK_DATA.scripts }));
router.get('/script-info', (req, res) => res.json([]));
router.get('/progress', (req, res) => res.json(SD_MOCK_DATA.progress));
router.get('/cmd-flags', (req, res) => res.json({}));
router.get('/memory', (req, res) => res.json({ ram: { free: 8589934592, used: 8589934592, total: 17179869184 }, cuda: { system: { free: 0, used: 0, total: 0 } } }));

// POST routes
router.post('/img2img', async (req, res) => {
  const { prompt, init_images } = req.body;

  try {
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const token = await tokenManager.getToken();
    if (!token) {
      throw new Error('No available token');
    }

    // Build message content with images
    const content = [{ type: 'text', text: prompt }];
    if (init_images && init_images.length > 0) {
      init_images.forEach(img => {
        const format = img.startsWith('/9j/') ? 'jpeg' : 'png';
        content.push({ type: 'image_url', image_url: { url: `data:image/${format};base64,${img}` } });
      });
    }

    const messages = [{ role: 'user', content }];
    const model = req.body.model || 'gemini-3-pro-image';
    const requestBody = prepareImageRequest(
      generateRequestBody(messages, model, {}, null, token)
    );

    const images = await generateImageForSD(requestBody, token);

    if (images.length === 0) {
      throw new Error('No image generated');
    }

    res.json({
      images,
      parameters: req.body,
      info: JSON.stringify({ prompt })
    });
  } catch (error) {
    logger.error('SD img2img failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/txt2img', async (req, res) => {
  const { prompt, negative_prompt, steps, cfg_scale, width, height, seed, sampler_name } = req.body;

  try {
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const token = await tokenManager.getToken();
    if (!token) {
      throw new Error('No available token');
    }

    const model = req.body.model || 'gemini-3-pro-image';
    const requestBody = buildImageRequestBody(prompt, token, model);
    const images = await generateImageForSD(requestBody, token);

    if (images.length === 0) {
      throw new Error('No image generated');
    }

    res.json({
      images,
      parameters: { prompt, negative_prompt, steps, cfg_scale, width, height, seed, sampler_name },
      info: JSON.stringify({ prompt, seed: seed || -1 })
    });
  } catch (error) {
    logger.error('SD txt2img failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/options', (req, res) => res.json({}));
router.post('/refresh-checkpoints', (req, res) => res.json(null));
router.post('/refresh-loras', (req, res) => res.json(null));
router.post('/interrupt', (req, res) => res.json(null));
router.post('/skip', (req, res) => res.json(null));

export default router;
