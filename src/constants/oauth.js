/**
 * Google OAuth Configuration
 * Unified management to avoid duplicate definitions and hardcoding across multiple files
 */
export const OAUTH_CONFIG = {
  CLIENT_ID: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  CLIENT_SECRET: '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',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth'
};

// Default OAuth Scope list used by the server side
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs'
];
