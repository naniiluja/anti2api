# Authentication Module

> 📍 **Location:** `src/auth/`
> 🔗 **Parent:** [Project Root](../../CLAUDE.md)

## Purpose

Manages Google OAuth tokens, JWT authentication for admin interface, token rotation strategies, and quota tracking for multi-account management.

## Files

| File | Description |
|------|-------------|
| `token_manager.js` | Core token management with rotation strategies |
| `token_store.js` | Async file-based token persistence |
| `jwt.js` | JWT authentication for admin routes |
| `oauth_manager.js` | OAuth flow handling |
| `quota_manager.js` | Model quota caching and tracking |

## Key Components

### token_manager.js

**Class:** `TokenManager`

**Core Methods:**
- `getToken()` - Get next available token (rotation-aware)
- `refreshToken(token)` - Refresh expired access token
- `addToken(tokenData)` - Add new token
- `deleteToken(refreshToken)` - Remove token
- `updateToken(refreshToken, updates)` - Update token properties
- `getTokenList()` - Get all tokens for admin UI
- `disableToken(token)` - Disable invalid token
- `markQuotaExhausted(token)` - Mark token quota as exhausted

**Rotation Strategies:**
```javascript
RotationStrategy = {
  ROUND_ROBIN: 'round_robin',      // Switch every request
  QUOTA_EXHAUSTED: 'quota_exhausted', // Switch when quota exhausted
  REQUEST_COUNT: 'request_count'   // Switch after N requests
}
```

### token_store.js

**Class:** `TokenStore`

**Features:**
- Async file read/write with debouncing
- In-memory cache with TTL
- Atomic merge operations
- Auto-creates `data/accounts.json` if missing

### jwt.js

**Exports:**
- `generateToken(payload)` - Create JWT
- `verifyToken(token)` - Validate JWT
- `authMiddleware` - Express middleware for protected routes

## Data Model

### Token Object
```javascript
{
  access_token: string,    // Google access token
  refresh_token: string,   // Google refresh token
  expires_in: number,      // Token TTL in seconds
  timestamp: number,       // Token issue timestamp
  enable: boolean,         // Token enabled flag
  projectId: string,       // Antigravity project ID
  email: string,           // Account email (optional)
  hasQuota: boolean,       // Quota availability flag
  sessionId: string        // Runtime session ID
}
```

## Dependencies

- `../config/config.js` - OAuth credentials, JWT secret
- `../constants/oauth.js` - OAuth configuration
- `../utils/idGenerator.js` - Session/Project ID generation
- `../utils/httpClient.js` - OAuth HTTP requests

## File Storage

```
data/
└── accounts.json    # Token storage (auto-generated)
```

## Security

- Tokens stored locally, never transmitted
- JWT expires after configured TTL
- Auto-disable tokens on 403/400 errors
- Concurrent token refresh on startup

---

*Last updated: 2025-12-27*
