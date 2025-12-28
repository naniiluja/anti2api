# Frontend Client

> 📍 **Location:** `client/`
> 🔗 **Parent:** [Project Root](../CLAUDE.md)

## Technology Stack

- **Framework:** React 18+
- **Build Tool:** Vite
- **Styling:** CSS with CSS Variables
- **State Management:** React Context
- **HTTP Client:** Axios
- **i18n:** Custom context with JSON locale files

## Project Structure

```
client/
├── src/
│   ├── api/              # API client configuration
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Common components
│   │   ├── layout/       # Layout components
│   │   └── ui/           # UI components
│   ├── context/          # React Context providers
│   ├── features/         # Feature modules
│   │   ├── auth/         # Login page
│   │   ├── dashboard/    # Dashboard page
│   │   ├── history/      # Request history
│   │   ├── playground/   # AI testing playground
│   │   ├── settings/     # Settings page
│   │   └── tokens/       # Token management
│   ├── hooks/            # Custom React hooks
│   ├── routes/           # React Router config
│   ├── App.jsx           # Main app component
│   └── main.jsx          # Entry point
├── public/
│   └── locales/          # i18n files (en.json, vi.json)
├── index.html
├── vite.config.js
└── package.json
```

## Feature Modules

### auth/
- `LoginPage.jsx` - Animated login with SpotlightCard effect

### dashboard/
- `DashboardPage.jsx` - System overview with stats
- `dashboardService.js` - Dashboard API calls

### tokens/
- `TokensPage.jsx` - Token list with cards
- `TokenCard.jsx` - Individual token display
- `AddTokenModal.jsx` - Add token form
- `EditTokenModal.jsx` - Edit token form
- `OAuthModal.jsx` - OAuth login flow
- `QuotaDisplay.jsx` - Quota visualization
- `tokenService.js` - Token API calls
- `quotaService.js` - Quota API calls

### playground/
- `PlaygroundPage.jsx` - Main playground container
- `ChatPlayground.jsx` - Chat testing interface
- `ImagePlayground.jsx` - Image generation testing
- `ChatMessage.jsx` - Chat message component
- `ImageViewer.jsx` - Image display component
- `ImageGallery.jsx` - Image gallery component
- `ParameterModal.jsx` - Generation parameters
- `ChatSessionHistory.jsx` - Session history
- `playgroundService.js` - Playground API calls
- `storageService.js` - Local storage utilities

### history/
- `HistoryPage.jsx` - Request history table
- `historyService.js` - History API calls

### settings/
- `SettingsPage.jsx` - Configuration editor

## Context Providers

| Context | Purpose |
|---------|---------|
| `AuthContext` | JWT token and login state |
| `I18nContext` | Internationalization |
| `ThemeContext` | Dark/light theme |
| `ToastContext` | Toast notifications |
| `ConfirmContext` | Confirmation dialogs |

## UI Components

### Common Components
- `ChromaGrid.jsx` - Animated grid background
- `Dock.jsx` - macOS-style dock
- `LanguageSelector.jsx` - Language switcher
- `LoadingSpinner.jsx` - Loading indicator
- `Modal.jsx` - Modal dialog
- `ShinyText.jsx` - Animated shiny text

### UI Components
- `SpotlightCard.jsx` - Card with spotlight effect
- `Squares.jsx` - Animated squares background
- `CountUp.jsx` - Animated number counter
- `MagicBento.jsx` - Bento grid layout

### Layout Components
- `MainLayout.jsx` - App layout with sidebar

## API Client

📍 **Location:** `src/api/axiosClient.js`

```javascript
import axiosClient from '../api/axiosClient';

// Automatically includes JWT token
const response = await axiosClient.get('/admin/tokens');
```

**Features:**
- Automatic JWT injection
- Response interceptors for 401 handling
- Base URL configuration

## Development

```bash
cd client
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## Build Output

Production build outputs to `client/dist/`, served by Express static middleware in production.

---

*Last updated: 2025-12-27*
