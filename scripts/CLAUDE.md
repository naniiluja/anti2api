# Scripts Module

> 📍 **Location:** `scripts/`
> 🔗 **Parent:** [Project Root](../CLAUDE.md)

## Mục đích

Các utility scripts hỗ trợ build, OAuth login, và token refresh.

## Files

| File | Mô tả | Command |
|------|-------|---------|
| `build.js` | Binary compilation script | `npm run build:*` |
| `oauth-server.js` | OAuth login helper server | `npm run login` |
| `refresh-tokens.js` | Token refresh utility | `npm run refresh` |

## build.js

**Purpose:** Compile Node.js application to standalone binaries using `pkg`.

**Supported platforms:**
- Windows x64 (`node18-win-x64`)
- Linux x64 (`node18-linux-x64`)
- Linux ARM64 (`node18-linux-arm64`)
- macOS x64 (`node18-macos-x64`)
- macOS ARM64 (`node18-macos-arm64`)

**Usage:**
```bash
# Single platform
npm run build:win          # Windows x64
npm run build:linux        # Linux x64
npm run build:linux-arm64  # Linux ARM64
npm run build:macos        # macOS x64
npm run build:macos-arm64  # macOS ARM64

# All platforms
npm run build:all
```

**Build process:**
1. Read `package.json` pkg configuration
2. Bundle source code with dependencies
3. Compile to native executable
4. Include assets (public/, config.json, .env.example)
5. Output to `dist/` directory

**Output structure:**
```
dist/
├── antigravity2api-win-x64.exe
├── antigravity2api-linux-x64
├── antigravity2api-linux-arm64
├── antigravity2api-macos-x64
└── antigravity2api-macos-arm64
```

**Configuration (package.json):**
```json
{
  "pkg": {
    "scripts": ["src/**/*.js", "scripts/**/*.js"],
    "assets": [
      "public/**/*",
      "src/bin/**/*",
      ".env.example",
      "config.json"
    ],
    "targets": [
      "node18-win-x64",
      "node18-linux-x64",
      "node18-linux-arm64",
      "node18-macos-x64",
      "node18-macos-arm64"
    ],
    "outputPath": "dist"
  }
}
```

## oauth-server.js

**Purpose:** Start a temporary OAuth server to handle Google authentication flow.

**Usage:**
```bash
npm run login
```

**Flow:**
1. Start local server on port 3000
2. Open browser to Google OAuth consent page
3. User authorizes application
4. Google redirects to `http://localhost:3000/oauth/callback`
5. Server exchanges code for tokens
6. Save tokens to `data/accounts.json`
7. Display success message
8. Shutdown server

**OAuth Scopes:**
- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/cloud-platform`

**Success output:**
```
🎉 Login successful!
Access Token: ya29.a0AfB_...
Refresh Token: 1//0gXXX...
Expires in: 3599 seconds

Token saved to: data/accounts.json
```

**Error handling:**
- Invalid OAuth code → Display error, retry
- Network errors → Log and exit
- Token save failures → Display error path

## refresh-tokens.js

**Purpose:** Manually refresh all expired or expiring tokens.

**Usage:**
```bash
npm run refresh
```

**Process:**
1. Read all tokens from `data/accounts.json`
2. Filter expired/expiring tokens (< 5 minutes remaining)
3. Refresh each token using OAuth refresh_token flow
4. Update tokens in file
5. Display refresh summary

**Output:**
```
🔄 Refreshing tokens...

Token 1 (ya29...abc):
  ✅ Refreshed successfully
  New expiry: 2025-12-31 16:30:00

Token 2 (ya29...def):
  ⏭️ Still valid (expires in 45 minutes)

Token 3 (ya29...xyz):
  ❌ Refresh failed: Invalid refresh token

Summary:
  ✅ Refreshed: 1
  ⏭️ Skipped: 1
  ❌ Failed: 1
```

**Token refresh criteria:**
```javascript
const shouldRefresh = (token) => {
  const expiryTime = token.timestamp + token.expires_in * 1000;
  const timeRemaining = expiryTime - Date.now();
  const BUFFER = 5 * 60 * 1000; // 5 minutes
  return timeRemaining < BUFFER;
};
```

## Common Features

### Path Resolution
All scripts use `paths.js` utility for cross-environment path resolution:
```javascript
import { getDataDir, getConfigPaths } from '../src/utils/paths.js';

const dataDir = getDataDir();  // Works in both dev and pkg environments
```

### Error Handling
```javascript
try {
  // Script logic
} catch (error) {
  logger.error('Script failed:', error.message);
  process.exit(1);
}
```

### Logging
All scripts use the centralized logger:
```javascript
import logger from '../src/utils/logger.js';

logger.info('Starting process...');
logger.error('Error occurred:', error);
```

## Development vs Production

**Development (node):**
```bash
node scripts/oauth-server.js
```

**Production (pkg binary):**
```bash
# Scripts bundled into binary, executed via snapshot
./antigravity2api-win-x64.exe --login
```

## Security Notes

**oauth-server.js:**
- Only binds to localhost (127.0.0.1)
- Temporary server (auto-closes after success)
- HTTPS redirect URI for production
- No token logging to console

**refresh-tokens.js:**
- Reads from secure file (data/accounts.json)
- Validates refresh_token before request
- Atomic file updates (backup before write)

**build.js:**
- Excludes `.env` from binary (use .env.example)
- Includes only necessary assets
- Source code obfuscated in binary

---

*Last updated: 2025-12-31*
