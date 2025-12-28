# Utilities Module

> 📍 **Location:** `src/utils/`
> 🔗 **Parent:** [Project Root](../../CLAUDE.md)

## Purpose

Shared utility functions and services used across the application, including format converters, HTTP clients, logging, memory management, and various helper functions.

## Files Overview

| File | Description |
|------|-------------|
| `logger.js` | Logging utility with levels and request timing |
| `memoryManager.js` | Memory pressure monitoring and GC triggering |
| `httpClient.js` | Axios wrapper with proxy support |
| `errors.js` | Custom error classes and handlers |
| `paths.js` | Path resolution for different environments |
| `idGenerator.js` | Session/Project ID generation |
| `imageStorage.js` | Base64 image saving and management |
| `deepMerge.js` | Deep object merging |
| `envParser.js` | Environment variable parsing |
| `configReloader.js` | Hot config reload support |
| `requestLogger.js` | Request history logging |
| `toolConverter.js` | Tool/function call conversion |
| `parameterNormalizer.js` | API parameter normalization |
| `thoughtSignatureCache.js` | Reasoning signature caching |
| `toolNameCache.js` | Tool name caching |
| `chatSessionStorage.js` | Chat session persistence |
| `galleryStorage.js` | Image gallery storage |

## Converters Sub-module

📍 **Location:** `src/utils/converters/`

| File | Description |
|------|-------------|
| `common.js` | Shared conversion utilities |
| `openai.js` | OpenAI format conversion |
| `claude.js` | Claude format conversion |
| `gemini.js` | Gemini format conversion |

## Key Components

### logger.js

```javascript
import logger from '../utils/logger.js';

logger.info('Message');
logger.warn('Warning');
logger.error('Error:', error.message);
logger.request('POST', '/v1/chat/completions', 200, 1234);
```

### memoryManager.js

**Class:** `MemoryManager`

**Features:**
- Dynamic pressure thresholds based on config
- Automatic GC triggering under pressure
- Cleanup callback registration
- Object pool size management

**Pressure Levels:**
```javascript
MemoryPressure = {
  LOW: 'low',         // < 30% threshold
  MEDIUM: 'medium',   // 30-60% threshold
  HIGH: 'high',       // 60-100% threshold
  CRITICAL: 'critical' // > 100% threshold
}
```

### httpClient.js

```javascript
import { httpRequest, httpStreamRequest, buildAxiosRequestConfig } from '../utils/httpClient.js';

// Non-streaming request
const response = await httpRequest({ method: 'POST', url, headers, data });

// Streaming request
const streamResponse = await httpStreamRequest({ method: 'POST', url, headers, data });
```

### errors.js

```javascript
import { createApiError, TokenError, errorHandler } from '../utils/errors.js';

// Create API error
throw createApiError('Error message', 500, responseBody);

// Token-specific error
throw new TokenError('Token expired', 'abcd1234', 401);
```

### paths.js

```javascript
import { getPublicDir, getDataDir, getConfigPaths, getRelativePath } from '../utils/paths.js';

const publicDir = getPublicDir();   // Handles pkg/node environments
const dataDir = getDataDir();       // data/ directory path
const { envPath, configJsonPath } = getConfigPaths();
```

### idGenerator.js

```javascript
import { generateSessionId, generateProjectId } from '../utils/idGenerator.js';

const sessionId = generateSessionId(); // UUID v4
const projectId = generateProjectId(); // Random project ID
```

## Format Converters

### openai.js
- `convertToAntigravityRequest(openaiRequest)` - OpenAI → Antigravity
- `convertToOpenAIResponse(antigravityResponse)` - Antigravity → OpenAI
- `buildOpenAIStreamChunk(...)` - Build SSE chunk

### claude.js
- `convertClaudeToAntigravity(claudeRequest)` - Claude → Antigravity
- `convertAntigravityToClaude(antigravityResponse)` - Antigravity → Claude

### gemini.js
- `convertGeminiToAntigravity(geminiRequest)` - Gemini → Antigravity
- `convertAntigravityToGemini(antigravityResponse)` - Antigravity → Gemini

---

*Last updated: 2025-12-27*
