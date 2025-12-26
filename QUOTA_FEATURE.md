# Model Quota Management

## Description

Added model quota viewing functionality, allowing users to check the remaining quota and reset time for each model associated with a Token in the frontend management interface.

## Implementation Plan

### Data Storage
- **accounts.json**: Kept concise, storing only core authentication information.
- **data/quotas.json**: New file specifically for storing quota information (lightweight persistence).
- **In-memory Cache**: 5-minute cache to avoid frequent API requests.
- **Auto Cleanup**: Deletes data that hasn't been updated for more than an hour every hour.

### Core Files

1. **src/api/client.js**
   - Added `getModelsWithQuotas(token)` function.
   - Extract `quotaInfo` field from API response.
   - Returns a simplified quota data structure.

2. **src/auth/quota_manager.js**
   - Quota cache management.
   - File persistence.
   - Conversion from UTC to local time (configured for Beijing time in code).
   - Auto-cleanup of expired data.

3. **src/routes/admin.js**
   - Added `GET /admin/tokens/:refreshToken/quotas` endpoint.
   - Supports on-demand fetching of quota information for a specific Token.

4. **client/src/...** (React components)
   - Integration with frontend UI for displaying quotas.
   - Progress bar rendering based on remaining quota percentage.

## Usage

### Frontend Operations

1. Log in to the management interface.
2. Click the **"📊 View Quota"** button in a Token card.
3. The system will automatically load all model quota information for that Token.
4. Displayed as progress bars:
   - Model name
   - Remaining quota percentage (color-coded)
   - Reset time (formatted)

### Data Format

#### API Response Example
```json
{
  "success": true,
  "data": {
    "lastUpdated": 1765109350660,
    "models": {
      "gemini-2.0-flash-exp": {
        "remaining": 0.972,
        "resetTime": "01-07 15:27",
        "resetTimeRaw": "2025-01-07T07:27:44Z"
      },
      "gemini-1.5-pro": {
        "remaining": 0.85,
        "resetTime": "01-07 16:15",
        "resetTimeRaw": "2025-01-07T08:15:30Z"
      }
    }
  }
}
```

#### quotas.json Storage Format
```json
{
  "meta": {
    "lastCleanup": 1765109350660,
    "ttl": 3600000
  },
  "quotas": {
    "1//0eDtvmkC_KgZv": {
      "lastUpdated": 1765109350660,
      "models": {
        "gemini-2.0-flash-exp": {
          "r": 0.972,
          "t": "2025-01-07T07:27:44Z"
        }
      }
    }
  }
}
```

## Features

✅ **On-demand Loading**: Quota information is only fetched when the user clicks view.  
✅ **Smart Caching**: Uses cache for repeated views within 5 minutes to reduce API requests.  
✅ **Auto Cleanup**: Periodically cleans up old data to keep the file lightweight.  
✅ **Visual Display**: Progress bars intuitively show remaining quota.  
✅ **Color Coding**: Green (>50%), Yellow (20-50%), Red (<20%).  
✅ **Time Conversion**: Automatically converts UTC time to local formatted time.  
✅ **Lightweight Storage**: Uses field abbreviations and only stores models with changes.  

## Notes

1. Calling the Google API for the first time might take a few seconds.
2. Quota information is cached for 5 minutes; wait for the cache to expire if you need the latest data.
3. The `quotas.json` file is created automatically; no manual configuration is required.
4. An error message will be displayed if the Token is expired or invalid.

## Testing

After starting the service:
```bash
npm start
```

Access the management interface and click the "View Quotas" button on any Token to test the functionality.
