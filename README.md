# Antigravity to OpenAI API Proxy Service

A proxy service that converts Google Antigravity API to OpenAI-compatible format, supporting streaming responses, tool calling, and multi-account management.

## Features

### API Features
- ✅ OpenAI API compatible format
- ✅ Streaming and non-streaming responses
- ✅ Tool calling (Function Calling) support
- ✅ Multi-account auto rotation (multiple rotation strategies)
- ✅ Auto Token refresh
- ✅ API Key authentication
- ✅ Chain of Thought (Thinking) output, compatible with OpenAI reasoning_effort and DeepSeek reasoning_content format
- ✅ Image input support (Base64 encoding)
- ✅ Image generation support (gemini-3-pro-image model)
- ✅ Pro account random ProjectId support
- ✅ Model quota viewing (real-time remaining quota and reset time)
- ✅ SD WebUI API compatible (txt2img/img2img support)
- ✅ Multi API format support (OpenAI, Gemini, Claude formats)

### Performance & Optimization
- ✅ Heartbeat mechanism (prevents Cloudflare timeout)
- ✅ Model list caching (reduces API requests)
- ✅ Memory optimization (reduced from 8+ to 2 processes, memory from 100MB+ to 50MB+)
- ✅ Object pool reuse (50%+ reduction in temp object creation, lower GC frequency)
- ✅ Dynamic memory threshold (auto-calculated based on user config)
- ✅ Pre-compiled binaries (Windows/Linux/macOS support, no Node.js required)

### Web Management Interface (React SPA)
- ✅ **Modern React + Vite Client** - Single Page Application with hot reload
- ✅ **Beautiful Login Page** - Dynamic animated background with SpotlightCard effects
- ✅ **Token Management** - Add, enable/disable, delete tokens with real-time updates
- ✅ **AI Playground** - Test Chat and Image Generation models directly in browser
- ✅ **Request History** - View and track all API requests with detailed logs
- ✅ **Settings Management** - Configure server settings, rotation strategies, and defaults
- ✅ **Auto Token Redirect** - Automatically redirect to login when token expires
- ✅ **i18n Support** - Vietnamese (🇻🇳) and English (🇺🇸) with dynamic switching
- ✅ **Privacy Mode** - Auto-hide sensitive information (tokens, project IDs)
- ✅ **Responsive Design** - Works on desktop and mobile devices

## Requirements

- Node.js >= 18.0.0

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

Edit `.env` file with required parameters:

```env
# Required configuration
API_KEY=sk-text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-jwt-secret-key-change-this-in-production

# Optional configuration
# PROXY=http://127.0.0.1:7890
# SYSTEM_INSTRUCTION=You are a chatbot
# IMAGE_BASE_URL=http://your-domain.com
```

### 3. Login to Get Token

```bash
npm run login
```

Browser will auto-open Google authorization page. After authorization, Token will be saved to `data/accounts.json`.

### 4. Start Service

```bash
npm start
```

Service will start at `http://localhost:8045`.

## Binary Deployment (Recommended)

No need to install Node.js, just download pre-compiled binary files.

### Download Binary Files

Download from [GitHub Releases](https://github.com/ZhaoShanGeng/antigravity2api-nodejs/releases) for your platform:

| Platform | Filename |
|----------|----------|
| Windows x64 | `antigravity2api-win-x64.exe` |
| Linux x64 | `antigravity2api-linux-x64` |
| Linux ARM64 | `antigravity2api-linux-arm64` |
| macOS x64 | `antigravity2api-macos-x64` |
| macOS ARM64 | `antigravity2api-macos-arm64` |

### Prepare Configuration Files

Place these files in the same directory as the binary:

```
├── antigravity2api-win-x64.exe  # Binary file
├── .env                          # Environment variables (required)
├── config.json                   # Base configuration (required)
├── public/                       # Static files directory (required)
│   ├── index.html
│   ├── style.css
│   ├── assets/
│   │   └── bg.jpg
│   └── js/
│       ├── auth.js
│       ├── config.js
│       ├── main.js
│       ├── quota.js
│       ├── tokens.js
│       ├── ui.js
│       └── utils.js
└── data/                         # Data directory (auto-created)
    └── accounts.json
```

### Configure Environment Variables

Create `.env` file:

```env
API_KEY=sk-your-api-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-jwt-secret-key-change-this-in-production
# IMAGE_BASE_URL=http://your-domain.com
# PROXY=http://127.0.0.1:7890
```

### Run

**Windows**:
```bash
# Double-click to run, or execute in command line
antigravity2api-win-x64.exe
```

**Linux/macOS**:
```bash
# Add execute permission
chmod +x antigravity2api-linux-x64

# Run
./antigravity2api-linux-x64
```

### Binary Deployment Notes

- **No Node.js Required**: Binary includes Node.js runtime
- **Config Files**: `.env` and `config.json` must be in same directory as binary
- **Static Files**: `public/` directory must be in same directory as binary
- **Data Persistence**: `data/` directory auto-created for Token storage
- **Cross-platform**: Windows, Linux, macOS (x64 and ARM64) supported

### Run as System Service (Linux)

Create systemd service file `/etc/systemd/system/antigravity2api.service`:

```ini
[Unit]
Description=Antigravity2API Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/antigravity2api
ExecStart=/opt/antigravity2api/antigravity2api-linux-x64
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable antigravity2api
sudo systemctl start antigravity2api
```

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Configure Environment Variables**

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` file with required parameters.

2. **Start Service**

```bash
docker-compose up -d
```

3. **View Logs**

```bash
docker-compose logs -f
```

4. **Stop Service**

```bash
docker-compose down
```

### Using Docker

1. **Build Image**

```bash
docker build -t antigravity2api .
```

2. **Run Container**

```bash
docker run -d \
  --name antigravity2api \
  -p 8045:8045 \
  -e API_KEY=sk-text \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin123 \
  -e JWT_SECRET=your-jwt-secret-key \
  -e IMAGE_BASE_URL=http://your-domain.com \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public/images:/app/public/images \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/config.json:/app/config.json \
  antigravity2api
```

3. **View Logs**

```bash
docker logs -f antigravity2api
```

### Docker Deployment Notes

- Data Persistence: `data/` directory mounted for Token data
- Image Storage: `public/images/` directory mounted for generated images
- Config Files: `.env` and `config.json` mounted, support hot reload
- Port Mapping: Default 8045, can be modified as needed
- Auto Restart: Container auto-restarts on abnormal exit

## Zeabur Deployment

### Deploy with Pre-built Image

1. **Create Service**

In Zeabur console, create new service with image:

```
ghcr.io/liuw1535/antigravity2api-nodejs
```

2. **Configure Environment Variables**

Add these environment variables in service settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | API authentication key | `sk-your-api-key` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password | `your-secure-password` |
| `JWT_SECRET` | JWT secret key | `your-jwt-secret-key` |
| `IMAGE_BASE_URL` | Image service base URL | `https://your-domain.zeabur.app` |

Optional variables:
- `PROXY`: Proxy address
- `SYSTEM_INSTRUCTION`: System prompt

3. **Configure Persistent Storage**

Add these mount points in "Volumes" settings:

| Mount Path | Description |
|------------|-------------|
| `/app/data` | Token data storage |
| `/app/public/images` | Generated images storage |

⚠️ **Important**:
- Only mount `/app/data` and `/app/public/images`
- Do NOT mount other directories (like `/app/.env`, `/app/config.json`), or essential config files will be cleared

4. **Bind Domain**

Bind domain in "Networking" settings, then set it to `IMAGE_BASE_URL` environment variable.

5. **Start Service**

After saving config, Zeabur will auto-pull image and start service. Access bound domain to use.

## Web Management Interface

After service starts, visit `http://localhost:8045` to open Web management interface.

### Features

- 🔐 **Secure Login**: JWT Token authentication, protects management interface
- 📊 **Real-time Stats**: Shows total Tokens, enabled/disabled status
- ➕ **Multiple Add Methods**:
  - OAuth authorization login (recommended): Auto-complete Google authorization flow
  - Manual input: Directly input Access Token and Refresh Token
- 🎯 **Token Management**:
  - View all Token details (Access Token suffix, Project ID, expiration time)
  - 📊 View model quota: Grouped by type (Claude/Gemini/Other), real-time remaining quota and reset time
  - One-click enable/disable Token
  - Delete invalid Tokens
  - Real-time refresh Token list
- ⚙️ **Config Management**:
  - Online edit server config (port, listen address)
  - Adjust default parameters (temperature, Top P/K, max tokens)
  - Modify security config (API key, request size limit)
  - Configure proxy, system prompt, etc.
  - Hot reload config (some configs require restart)
- 🌐 **Language Support**:
  - Vietnamese (🇻🇳) and English (🇺🇸)
  - Language selector in login form and header
  - Persistent language preference

### Usage Flow

1. **Login**
   - Use `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`
   - JWT Token auto-saved to browser after successful login

2. **Add Token**
   - **OAuth Method** (Recommended):
     1. Click "OAuth Login" button
     2. Click "Open Authorization Page" in popup
     3. Complete Google authorization in new window
     4. Copy complete callback URL from browser address bar
     5. Paste to input box and submit
   - **Manual Method**:
     1. Click "Manual Input" button
     2. Fill in Access Token, Refresh Token, and expiration time
     3. Submit to save

3. **Manage Tokens**
   - View Token card status and info
   - Click "📊 View Quota" to see account model quota info
     - Auto-grouped by model type (Claude/Gemini/Other)
     - Shows remaining quota percentage and progress bar
     - Shows quota reset time
     - "Refresh" button to force update quota data
   - Use "Enable/Disable" button to control Token status
   - Use "Delete" button to remove invalid Tokens
   - Click "Refresh" button to update list

4. **Privacy Mode**
   - Enabled by default, auto-hides Token, Project ID, and sensitive info
   - Click "Show Sensitive Info" to toggle display/hide status

5. **Configure Rotation Strategy**
   - Three rotation strategies supported:
     - `round_robin`: Load balancing, switch Token each request
     - `quota_exhausted`: Switch only when quota exhausted
     - `request_count`: Custom request count before switching
   - Configurable in "Settings" page

## API Usage

Service provides OpenAI-compatible API interface. See [API.md](API.md) for detailed usage.

### Quick Test

```bash
curl http://localhost:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-text" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Multi-Account Management

`data/accounts.json` supports multiple accounts, service will auto-rotate:

```json
[
  {
    "access_token": "ya29.xxx",
    "refresh_token": "1//xxx",
    "expires_in": 3599,
    "timestamp": 1234567890000,
    "enable": true
  },
  {
    "access_token": "ya29.yyy",
    "refresh_token": "1//yyy",
    "expires_in": 3599,
    "timestamp": 1234567890000,
    "enable": true
  }
]
```

- `enable: false` to disable an account
- Token auto-refreshes when expired
- Auto-disables and switches to next account on refresh failure (403)

## Configuration

Project configuration has two parts:

### 1. config.json (Base Configuration)

Base config file with server, API, and default parameter settings:

```json
{
  "server": {
    "port": 8045,              // Service port
    "host": "0.0.0.0",         // Listen address
    "maxRequestSize": "500mb", // Max request body size
    "heartbeatInterval": 15000,// Heartbeat interval (ms), prevents Cloudflare timeout
    "memoryThreshold": 100     // Memory threshold (MB), triggers GC when exceeded
  },
  "rotation": {
    "strategy": "round_robin", // Rotation strategy: round_robin/quota_exhausted/request_count
    "requestCount": 50         // Requests per Token for request_count strategy
  },
  "defaults": {
    "temperature": 1,          // Default temperature
    "topP": 1,                 // Default top_p
    "topK": 50,                // Default top_k
    "maxTokens": 32000,        // Default max tokens
    "thinkingBudget": 1024     // Default thinking budget (thinking models only, range 1024-32000)
  },
  "cache": {
    "modelListTTL": 3600000    // Model list cache time (ms), default 1 hour
  },
  "other": {
    "timeout": 300000,         // Request timeout (ms)
    "skipProjectIdFetch": false,// Skip ProjectId fetch, generate randomly (Pro accounts only)
    "useNativeAxios": false,   // Use native axios instead of AntigravityRequester
    "useContextSystemPrompt": false, // Merge request system messages into SystemInstruction
    "passSignatureToClient": false   // Pass thoughtSignature to client
  }
}
```

### Rotation Strategy

| Strategy | Description |
|----------|-------------|
| `round_robin` | Load balancing: Switch to next Token after each request |
| `quota_exhausted` | Quota exhausted: Use current Token until quota runs out (performance optimized) |
| `request_count` | Custom count: Switch after specified requests (default strategy) |

### 2. .env (Sensitive Configuration)

Environment variable config file with sensitive info and optional settings:

| Variable | Description | Required |
|----------|-------------|----------|
| `API_KEY` | API authentication key | ✅ |
| `ADMIN_USERNAME` | Admin username | ✅ |
| `ADMIN_PASSWORD` | Admin password | ✅ |
| `JWT_SECRET` | JWT secret key | ✅ |
| `PROXY` | Proxy address (e.g., http://127.0.0.1:7890), also supports system proxy `HTTP_PROXY`/`HTTPS_PROXY` | ❌ |
| `SYSTEM_INSTRUCTION` | System prompt | ❌ |
| `IMAGE_BASE_URL` | Image service base URL | ❌ |

See `.env.example` for complete config example.

## Development Commands

```bash
# Start production service (backend only)
npm start

# Development mode (backend + frontend with hot reload)
npm run dev

# Development mode (backend only with watch)
npm run dev:backend

# Development mode (frontend only)
npm run dev:client

# Login to get Token via OAuth
npm run login

# Build binaries for different platforms
npm run build:win        # Windows x64
npm run build:linux      # Linux x64
npm run build:linux-arm64 # Linux ARM64
npm run build:macos      # macOS x64
npm run build:macos-arm64 # macOS ARM64
npm run build:all        # All platforms
```

## Project Structure

```
.
├── client/                     # React SPA Frontend (Vite)
│   ├── src/
│   │   ├── api/               # API client configuration
│   │   │   └── axiosClient.js # Axios instance with interceptors
│   │   ├── components/        # Reusable UI components
│   │   │   ├── common/        # Common components (ShinyText, etc.)
│   │   │   ├── layout/        # Layout components (MainLayout, Sidebar)
│   │   │   └── ui/            # UI components (SpotlightCard, Squares)
│   │   ├── context/           # React Context providers
│   │   │   ├── AuthContext.jsx    # Authentication state
│   │   │   └── LanguageContext.jsx # i18n language state
│   │   ├── features/          # Feature modules
│   │   │   ├── auth/          # Login page with animated background
│   │   │   ├── history/       # Request history tracking
│   │   │   ├── playground/    # AI Chat & Image Generation testing
│   │   │   ├── settings/      # Server configuration
│   │   │   └── tokens/        # Token management (add, edit, quota)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── routes/            # React Router configuration
│   │   ├── App.jsx            # Main application component
│   │   └── main.jsx           # Application entry point
│   ├── public/
│   │   └── locales/           # i18n translation files (vi.json, en.json)
│   ├── index.html             # HTML template
│   ├── vite.config.js         # Vite configuration
│   └── package.json           # Frontend dependencies
├── data/
│   ├── accounts.json          # Token storage (auto-generated)
│   └── quotas.json            # Quota cache (auto-generated)
├── public/                    # Static files (legacy, served by Express)
│   └── images/                # Generated images storage
├── src/                       # Node.js Backend
│   ├── api/
│   │   ├── client.js          # API call logic (with model list cache)
│   │   └── stream_parser.js   # Stream response parser (object pool optimized)
│   ├── auth/
│   │   ├── jwt.js             # JWT authentication
│   │   ├── token_manager.js   # Token management (with rotation strategy)
│   │   ├── token_store.js     # Token file storage (async read/write)
│   │   └── quota_manager.js   # Quota cache management
│   ├── routes/
│   │   ├── admin.js           # Admin interface routes
│   │   └── sd.js              # SD WebUI compatible interface
│   ├── config/
│   │   ├── config.js          # Config loader
│   │   └── init-env.js        # Environment variable init
│   ├── server/
│   │   └── index.js           # Main server (with memory management and heartbeat)
│   └── utils/
│       ├── converters/        # Format converters
│       │   ├── common.js      # Common functions
│       │   ├── openai.js      # OpenAI format
│       │   ├── claude.js      # Claude format
│       │   └── gemini.js      # Gemini format
│       └── ...                # Other utilities
├── scripts/                   # Build and utility scripts
│   ├── build.js               # Binary build script
│   ├── oauth-server.js        # OAuth login helper
│   └── refresh-tokens.js      # Token refresh utility
├── .env                       # Environment variables (sensitive info)
├── .env.example               # Environment variables example
├── config.json                # Base config file
├── Dockerfile                 # Docker build file (full build)
├── Dockerfile.binary          # Docker build file (binary deployment)
├── docker-compose.yml         # Docker Compose config
└── package.json               # Backend dependencies & scripts
```

## Multi API Format Support

Service supports three API formats, each with complete parameter support:

### OpenAI Format (`/v1/chat/completions`)

```json
{
  "model": "gemini-2.0-flash-thinking-exp",
  "max_tokens": 16000,
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "thinking_budget": 10000,
  "reasoning_effort": "high",
  "messages": [...]
}
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `max_tokens` | Max output tokens | 32000 |
| `temperature` | Temperature (0.0-1.0) | 1 |
| `top_p` | Top-P sampling | 1 |
| `top_k` | Top-K sampling | 50 |
| `thinking_budget` | Thinking budget (1024-32000) | 1024 |
| `reasoning_effort` | Thinking effort (`low`/`medium`/`high`) | - |

### Claude Format (`/v1/messages`)

```json
{
  "model": "claude-sonnet-4-5-thinking",
  "max_tokens": 16000,
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10000
  },
  "messages": [...]
}
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `max_tokens` | Max output tokens | 32000 |
| `temperature` | Temperature (0.0-1.0) | 1 |
| `top_p` | Top-P sampling | 1 |
| `top_k` | Top-K sampling | 50 |
| `thinking.type` | Thinking switch (`enabled`/`disabled`) | - |
| `thinking.budget_tokens` | Thinking budget (1024-32000) | 1024 |

### Gemini Format (`/v1beta/models/:model:generateContent`)

```json
{
  "contents": [...],
  "generationConfig": {
    "maxOutputTokens": 16000,
    "temperature": 0.7,
    "topP": 0.9,
    "topK": 40,
    "thinkingConfig": {
      "includeThoughts": true,
      "thinkingBudget": 10000
    }
  }
}
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `maxOutputTokens` | Max output tokens | 32000 |
| `temperature` | Temperature (0.0-1.0) | 1 |
| `topP` | Top-P sampling | 1 |
| `topK` | Top-K sampling | 50 |
| `thinkingConfig.includeThoughts` | Include thinking content | true |
| `thinkingConfig.thinkingBudget` | Thinking budget (1024-32000) | 1024 |

### reasoning_effort Mapping

| Value | Thinking Token Budget |
|-------|----------------------|
| `low` | 1024 |
| `medium` | 16000 |
| `high` | 32000 |

## Memory Optimization

Service has been deeply memory-optimized:

### Optimization Results

| Metric | Before | After |
|--------|--------|-------|
| Processes | 8+ | 2 |
| Memory Usage | 100MB+ | 50MB+ |
| GC Frequency | High | Low |

### Optimization Methods

1. **Object Pool Reuse**: Stream response objects reused via pool, 50%+ reduction in temp object creation
2. **Pre-compiled Constants**: Regex, format strings pre-compiled, avoid repeated creation
3. **LineBuffer Optimization**: Efficient stream line splitting, avoids frequent string operations
4. **Auto Memory Cleanup**: Auto-triggers GC when heap exceeds threshold
5. **Process Reduction**: Removed unnecessary subprocesses, unified processing in main process

### Dynamic Memory Threshold

Memory pressure thresholds dynamically calculated based on user-configured `memoryThreshold` (MB):

| Pressure Level | Threshold Ratio | Default (100MB config) | Behavior |
|----------------|-----------------|------------------------|----------|
| LOW | 30% | 30MB | Normal operation |
| MEDIUM | 60% | 60MB | Light cleanup |
| HIGH | 100% | 100MB | Active cleanup + GC |
| CRITICAL | >100% | >100MB | Emergency cleanup + forced GC |

## Heartbeat Mechanism

To prevent CDNs like Cloudflare from disconnecting due to long inactivity, service implements SSE heartbeat:

- Periodically sends heartbeat packets (`: heartbeat\n\n`) during streaming
- Default 15 seconds interval, configurable
- Heartbeat packets comply with SSE spec, clients auto-ignore

### Configuration

```json
{
  "server": {
    "heartbeatInterval": 15000
  }
}
```

- `heartbeatInterval`: Heartbeat interval (ms), set to 0 to disable

## Notes

1. First use requires copying `.env.example` to `.env` and configuring
2. Run `npm run login` to get Token
3. `.env` and `data/accounts.json` contain sensitive info, do not leak
4. Multi-account rotation supported for higher availability
5. Token auto-refreshes, no manual maintenance needed

## License

MIT
