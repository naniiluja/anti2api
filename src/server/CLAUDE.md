# Server Module

> 📍 **Location:** `src/server/`
> 🔗 **Parent:** [Project Root](../../CLAUDE.md)

## Mục đích

Mô-đun server chính xử lý khởi tạo ứng dụng Express, middleware chain, routing, và quản lý vòng đời server (startup, shutdown, error handling).

## Files

| File | Mô tả |
|------|-------|
| `index.js` | Entry point chính - cấu hình Express, middleware, routes |
| `stream.js` | Stream processing utilities với object pooling |
| `handlers/openai.js` | OpenAI request handler |
| `handlers/claude.js` | Claude request handler |
| `handlers/gemini.js` | Gemini request handler |

## Components chính

### index.js

**Trách nhiệm:**
- Express app initialization
- Middleware chain setup (CORS, compression, JSON parser)
- Static file serving
- Route mounting
- API key authentication middleware
- Memory management initialization
- Graceful shutdown handling

**Middleware Chain:**
```javascript
1. CORS                          // Cross-origin support
2. Compression                   // Gzip response compression
3. JSON Parser                   // Body parsing (max 500MB)
4. Static Files                  // /images, public directory
5. Admin Routes                  // /admin/* (no auth required)
6. Request Logging               // Timing and path logging
7. API Key Validation            // /v1/* and /v1beta/* routes
8. API Routes                    // Claude, OpenAI, Gemini, SD
9. Error Handler                 // Centralized error response
```

**Startup sequence:**
1. Memory manager initialization
2. Middleware setup
3. Route mounting
4. Server listening
5. Error handling setup

**Shutdown sequence:**
1. Stop memory manager
2. Close AntigravityRequester subprocess
3. Clear object pools
4. Close Express server
5. Force exit after 5s timeout

### stream.js

**Features:**
- Object pool for stream chunks
- Chunk reuse to reduce GC pressure
- Pool size management based on memory pressure
- Automatic cleanup registration

**Exports:**
- `getChunkPoolSize()` - Get current pool size
- `clearChunkPool()` - Clear all pooled objects

### handlers/*.js

**Common pattern:**
```javascript
export async function handleRequest(req, res) {
  // 1. Convert request format
  const antigravityReq = convertToAntigravity(req.body);

  // 2. Get token
  const token = await tokenManager.getToken();

  // 3. Call API (streaming or non-streaming)
  if (req.body.stream) {
    await generateStreamResponse(antigravityReq, token, (chunk) => {
      res.write(chunk);
    });
  } else {
    const result = await generateResponse(antigravityReq, token);
    res.json(convertToFormat(result));
  }
}
```

## Dependencies

- `express` - Web framework
- `cors` - CORS middleware
- `compression` - Gzip compression
- `../api/client.js` - Antigravity API client
- `../auth/token_manager.js` - Token management
- `../auth/jwt.js` - JWT verification
- `../config/config.js` - Configuration
- `../utils/memoryManager.js` - Memory monitoring
- `../utils/logger.js` - Logging

## Configuration

```javascript
config.server = {
  port: 8046,               // Server port
  host: "0.0.0.0",          // Listen address
  maxRequestSize: "500mb",  // Max body size
  heartbeatInterval: 15000, // SSE heartbeat (ms)
  memoryThreshold: 50       // Memory threshold (MB)
};

config.security = {
  apiKey: process.env.API_KEY,           // API authentication
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET
};
```

## Endpoints routing

```
/                           → Static files (React SPA)
/admin/*                    → Admin routes (JWT auth)
/v1/chat/completions        → OpenAI handler
/v1/models                  → Model list (OpenAI/Claude format)
/v1/messages                → Claude handler
/v1beta/models/:model:*     → Gemini handler
/sdapi/v1/*                 → SD WebUI handler
/health                     → Health check
/v1/memory                  → Memory stats
```

## Error handling

**Error types:**
- `ApiError` - API request failures (400-500)
- `TokenError` - Token-related issues
- `ValidationError` - Request validation failures

**Error response format:**
```json
{
  "error": "Error message",
  "status": 500,
  "details": { /* Optional error details */ }
}
```

## Graceful shutdown

**Signals handled:**
- `SIGINT` (Ctrl+C)
- `SIGTERM` (Docker stop)

**Cleanup steps:**
1. Stop accepting new connections
2. Stop memory manager
3. Close subprocess requester
4. Clear object pools
5. Close server
6. Exit process (force after 5s)

## Memory management integration

```javascript
// Auto-start memory manager
memoryManager.setThreshold(config.server.memoryThreshold);
memoryManager.start(MEMORY_CHECK_INTERVAL);

// Register cleanup on shutdown
process.on('SIGINT', () => {
  memoryManager.stop();
  clearChunkPool();
});
```

---

*Last updated: 2025-12-31*
