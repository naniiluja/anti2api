# Constants Module

> 📍 **Location:** `src/constants/`
> 🔗 **Parent:** [Project Root](../../CLAUDE.md)

## Mục đích

Định nghĩa các hằng số toàn cục được sử dụng trong toàn bộ ứng dụng (OAuth config, memory thresholds, timeouts, etc).

## Files

| File | Mô tả |
|------|-------|
| `index.js` | General constants (memory, timing, defaults) |
| `oauth.js` | OAuth 2.0 configuration constants |

## Key Constants

### index.js

**Memory Management:**
```javascript
export const MEMORY_CHECK_INTERVAL = 5000;  // Memory check interval (ms)
export const MEMORY_PRESSURE_THRESHOLDS = {
  LOW: 0.3,      // 30% of threshold
  MEDIUM: 0.6,   // 60% of threshold
  HIGH: 1.0,     // 100% of threshold
  CRITICAL: 1.5  // 150% of threshold
};
```

**Token Rotation:**
```javascript
export const DEFAULT_REQUEST_COUNT_PER_TOKEN = 50;
export const TOKEN_REFRESH_BUFFER = 300; // Refresh 5 minutes before expiry
```

**API Defaults:**
```javascript
export const MODEL_LIST_CACHE_TTL = 3600000; // 1 hour
export const DEFAULT_TIMEOUT = 300000;       // 5 minutes
export const DEFAULT_RETRY_TIMES = 3;
```

**Stream Processing:**
```javascript
export const CHUNK_POOL_INITIAL_SIZE = 10;
export const CHUNK_POOL_MAX_SIZE = 50;
export const LINE_BUFFER_INITIAL_SIZE = 5;
```

### oauth.js

**OAuth Configuration:**
```javascript
export const OAUTH_CONFIG = {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:3000/oauth/callback',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/cloud-platform'
  ]
};
```

**OAuth Endpoints:**
```javascript
export const OAUTH_ENDPOINTS = {
  AUTHORIZE: '/oauth/authorize',
  CALLBACK: '/oauth/callback',
  TOKEN: '/oauth/token',
  REFRESH: '/oauth/refresh'
};
```

## Usage Examples

### Memory Management
```javascript
import { MEMORY_CHECK_INTERVAL, MEMORY_PRESSURE_THRESHOLDS } from '../constants/index.js';

memoryManager.start(MEMORY_CHECK_INTERVAL);

if (pressure >= MEMORY_PRESSURE_THRESHOLDS.CRITICAL) {
  // Emergency cleanup
}
```

### Token Rotation
```javascript
import { DEFAULT_REQUEST_COUNT_PER_TOKEN, TOKEN_REFRESH_BUFFER } from '../constants/index.js';

const shouldRefresh = (token.timestamp + token.expires_in * 1000 - Date.now())
                      < TOKEN_REFRESH_BUFFER * 1000;
```

### OAuth Flow
```javascript
import { OAUTH_CONFIG, OAUTH_ENDPOINTS } from '../constants/oauth.js';

const authUrl = `${OAUTH_CONFIG.authUrl}?client_id=${OAUTH_CONFIG.clientId}&...`;
```

## Constant Categories

### Timing Constants
- `MEMORY_CHECK_INTERVAL` - Memory monitoring frequency
- `MODEL_LIST_CACHE_TTL` - Model cache duration
- `DEFAULT_TIMEOUT` - API request timeout
- `TOKEN_REFRESH_BUFFER` - Token refresh threshold

### Size Constants
- `CHUNK_POOL_INITIAL_SIZE` - Object pool initial size
- `CHUNK_POOL_MAX_SIZE` - Object pool maximum size
- `LINE_BUFFER_INITIAL_SIZE` - Line buffer pool size

### Threshold Constants
- `MEMORY_PRESSURE_THRESHOLDS` - Memory pressure levels
- `DEFAULT_REQUEST_COUNT_PER_TOKEN` - Default rotation count

### Configuration Constants
- `OAUTH_CONFIG` - OAuth 2.0 settings
- `OAUTH_ENDPOINTS` - OAuth route paths

## Environment-specific Overrides

Một số constants có thể được override bởi config:

```javascript
// Default constant
import { MODEL_LIST_CACHE_TTL } from '../constants/index.js';

// Override from config
const cacheTTL = config.cache?.modelListTTL || MODEL_LIST_CACHE_TTL;
```

## Modification Guidelines

**Khi nào nên thay đổi constants:**
- Performance tuning (memory thresholds, pool sizes)
- Timeout adjustments
- OAuth configuration updates

**Khi nào KHÔNG nên thay đổi:**
- OAuth scopes (might break authentication)
- Critical thresholds (could cause instability)
- API endpoint formats

**Best practices:**
1. Document reason for changes
2. Test thoroughly before deployment
3. Consider backward compatibility
4. Update related documentation

---

*Last updated: 2025-12-31*
