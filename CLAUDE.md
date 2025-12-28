# Anti2API - Antigravity to OpenAI API Proxy Service

> **Last Updated:** 2025-12-27 22:22:57
> **Project Type:** Node.js (ES Modules) + React SPA
> **Node Version:** >= 18.0.0

## Project Vision

A high-performance proxy service that converts Google Antigravity API to multiple AI API formats (OpenAI, Claude, Gemini), featuring multi-account management, token rotation, streaming responses, and a modern React-based web management interface.

## Architecture Overview

```mermaid
graph TB
    subgraph Client["Client Layer"]
        OPENAI[OpenAI API Client]
        CLAUDE[Claude API Client]
        GEMINI[Gemini API Client]
        SDAPI[SD WebUI Client]
        WEB[Web Management UI]
    end

    subgraph Server["Backend - Express.js"]
        ROUTES[Route Handlers]
        HANDLERS[Request Handlers]
        AUTH[Authentication & Token Management]
        STREAM[Stream Processing]
        CONFIG[Configuration]
    end

    subgraph External["External Services"]
        ANTIGRAVITY[Google Antigravity API]
        OAUTH[Google OAuth2]
    end

    subgraph Frontend["Frontend - React + Vite"]
        PAGES[Feature Pages]
        CONTEXT[React Contexts]
        COMPONENTS[UI Components]
    end

    OPENAI --> |/v1/chat/completions| ROUTES
    CLAUDE --> |/v1/messages| ROUTES
    GEMINI --> |/v1beta/...| ROUTES
    SDAPI --> |/sdapi/v1/...| ROUTES
    WEB --> |/admin/*| ROUTES

    ROUTES --> HANDLERS
    HANDLERS --> AUTH
    HANDLERS --> STREAM
    AUTH --> CONFIG

    HANDLERS --> ANTIGRAVITY
    AUTH --> OAUTH

    WEB --> FRONTEND
    FRONTEND --> PAGES
    PAGES --> CONTEXT
    PAGES --> COMPONENTS
```

## Module Structure

```mermaid
graph LR
    subgraph Backend["src/ - Backend Modules"]
        API[api/]
        AUTH[auth/]
        CONFIG[config/]
        ROUTES[routes/]
        SERVER[server/]
        UTILS[utils/]
        CONSTANTS[constants/]
    end

    subgraph Frontend["client/src/ - Frontend Modules"]
        FEATURES[features/]
        COMPS[components/]
        CTX[context/]
        HOOKS[hooks/]
    end

    API --> |stream_parser.js| STREAM_PARSE
    API --> |client.js| API_CLIENT
    AUTH --> |token_manager.js| TOKEN_MGR
    AUTH --> |jwt.js| JWT_AUTH
    ROUTES --> |openai.js| OPENAI_ROUTE
    ROUTES --> |claude.js| CLAUDE_ROUTE
    ROUTES --> |gemini.js| GEMINI_ROUTE
```

## Module Index

| Module | Path | Description |
|--------|------|-------------|
| **Server Entry** | `src/server/index.js` | Express app setup, middleware, routes |
| **API Client** | `src/api/client.js` | Antigravity API calls, model list caching |
| **Stream Parser** | `src/api/stream_parser.js` | SSE stream parsing with object pool |
| **Token Manager** | `src/auth/token_manager.js` | Multi-account rotation, token refresh |
| **Token Store** | `src/auth/token_store.js` | Async file-based token persistence |
| **JWT Auth** | `src/auth/jwt.js` | Admin authentication |
| **Config** | `src/config/config.js` | Configuration loader (JSON + env) |
| **Routes** | `src/routes/*.js` | API endpoints (OpenAI, Claude, Gemini, SD) |
| **Handlers** | `src/server/handlers/*.js` | Request processing logic |
| **Converters** | `src/utils/converters/*.js` | Format conversion (OpenAI/Claude/Gemini) |
| **Frontend** | `client/src/` | React SPA with Vite |

## Key Entry Points

- **Backend Entry:** `src/server/index.js`
- **Frontend Entry:** `client/src/main.jsx`
- **Configuration:** `.env` + `config.json`
- **Token Storage:** `data/accounts.json`

## Development Commands

```bash
# Production
npm start                    # Start backend (with GC)
npm run start:no-gc          # Start without GC optimization

# Development
npm run dev                  # Backend + Frontend with hot reload
npm run dev:backend          # Backend only with watch
npm run dev:client           # Frontend only

# Build
npm run build:win            # Windows x64
npm run build:linux          # Linux x64
npm run build:all            # All platforms

# Utilities
npm run login                # OAuth login to get token
npm run refresh              # Refresh tokens
```

## API Endpoints

| Endpoint | Format | Description |
|----------|--------|-------------|
| `POST /v1/chat/completions` | OpenAI | Chat completions |
| `GET /v1/models` | OpenAI | List models |
| `POST /v1/messages` | Claude | Claude messages API |
| `POST /v1beta/models/:model:generateContent` | Gemini | Gemini generate |
| `POST /sdapi/v1/txt2img` | SD WebUI | Text to image |
| `POST /sdapi/v1/img2img` | SD WebUI | Image to image |
| `GET /admin/*` | Internal | Admin management |

## Configuration

### Environment Variables (.env)
```env
API_KEY=sk-your-key           # Required: API authentication
ADMIN_USERNAME=admin          # Required: Admin login
ADMIN_PASSWORD=password       # Required: Admin password
JWT_SECRET=secret             # Required: JWT signing key
PROXY=http://127.0.0.1:7890   # Optional: Proxy server
SYSTEM_INSTRUCTION=...        # Optional: Default system prompt
IMAGE_BASE_URL=...            # Optional: Base URL for images
```

### Base Configuration (config.json)
```json
{
  "server": { "port": 8045, "host": "0.0.0.0" },
  "rotation": { "strategy": "round_robin", "requestCount": 50 },
  "defaults": { "temperature": 1, "maxTokens": 32000 },
  "cache": { "modelListTTL": 3600000 }
}
```

## Token Rotation Strategies

| Strategy | Behavior |
|----------|----------|
| `round_robin` | Switch token after each request |
| `quota_exhausted` | Switch only when quota runs out |
| `request_count` | Switch after N requests (configurable) |

## Global Standards

### Code Style
- ES Modules (import/export)
- Async/await for all async operations
- JSDoc comments for public functions
- English comments in code

### Error Handling
- Use `createApiError()` for API errors
- Centralized error handler middleware
- Graceful shutdown handling

### Memory Management
- Object pooling for stream chunks
- Dynamic memory thresholds
- Automatic GC triggering under pressure

### Logging
- Use `logger` from `src/utils/logger.js`
- Request logging with timing
- Structured log levels (info, warn, error)

## Security Notes

- All API endpoints require API key authentication
- Admin routes require JWT authentication
- Tokens stored locally in `data/accounts.json`
- Never commit `.env` or `data/` to version control

---

## Navigation

- [Backend API Module](src/api/CLAUDE.md)
- [Authentication Module](src/auth/CLAUDE.md)
- [Routes Module](src/routes/CLAUDE.md)
- [Utilities Module](src/utils/CLAUDE.md)
- [Frontend Client](client/CLAUDE.md)
