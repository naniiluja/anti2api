import axios from 'axios';
import crypto from 'crypto';
import log from '../utils/logger.js';
import config from '../config/config.js';
import { generateProjectId } from '../utils/idGenerator.js';
import tokenManager from './token_manager.js';
import { OAUTH_CONFIG, OAUTH_SCOPES } from '../constants/oauth.js';
import { buildAxiosRequestConfig } from '../utils/httpClient.js';

class OAuthManager {
  constructor() {
    this.state = crypto.randomUUID();
  }

  /**
   * Generate authorization URL
   */
  generateAuthUrl(port) {
    const params = new URLSearchParams({
      access_type: 'offline',
      client_id: OAUTH_CONFIG.CLIENT_ID,
      prompt: 'consent',
      redirect_uri: `http://localhost:${port}/oauth-callback`,
      response_type: 'code',
      scope: OAUTH_SCOPES.join(' '),
      state: this.state
    });
    return `${OAUTH_CONFIG.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for token
   */
  async exchangeCodeForToken(code, port) {
    const postData = new URLSearchParams({
      code,
      client_id: OAUTH_CONFIG.CLIENT_ID,
      client_secret: OAUTH_CONFIG.CLIENT_SECRET,
      redirect_uri: `http://localhost:${port}/oauth-callback`,
      grant_type: 'authorization_code'
    });

    const response = await axios(buildAxiosRequestConfig({
      method: 'POST',
      url: OAUTH_CONFIG.TOKEN_URL,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: postData.toString(),
      timeout: config.timeout
    }));

    return response.data;
  }

  /**
   * Get user email
   */
  async fetchUserEmail(accessToken) {
    try {
      const response = await axios(buildAxiosRequestConfig({
        method: 'GET',
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        headers: {
          'Host': 'www.googleapis.com',
          'User-Agent': 'Go-http-client/1.1',
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'gzip'
        },
        timeout: config.timeout
      }));
      return response.data?.email;
    } catch (err) {
      log.warn('Failed to get user email:', err.message);
      return null;
    }
  }

  /**
   * Eligibility check: try to get projectId, fallback to random projectId on failure
   */
  async validateAndGetProjectId(accessToken) {
    // If config skips API validation, return random projectId directly
    if (config.skipProjectIdFetch) {
      const projectId = generateProjectId();
      log.info('Skipped API validation, using randomly generated projectId: ' + projectId);
      return { projectId, hasQuota: true };
    }

    // Try to get projectId from API
    try {
      log.info('Validating account eligibility...');
      const projectId = await tokenManager.fetchProjectId({ access_token: accessToken });

      if (projectId === undefined) {
        // Not eligible, fallback to random projectId
        const randomProjectId = generateProjectId();
        log.warn('This account is not eligible, auto fallback to ineligible mode, using random projectId: ' + randomProjectId);
        return { projectId: randomProjectId, hasQuota: false };
      }

      log.info('Account validation passed, projectId: ' + projectId);
      return { projectId, hasQuota: true };
    } catch (err) {
      // On failure, also fallback to random projectId
      const randomProjectId = generateProjectId();
      log.warn('Failed to validate account eligibility: ' + err.message + ', auto fallback to ineligible mode');
      log.info('Using randomly generated projectId: ' + randomProjectId);
      return { projectId: randomProjectId, hasQuota: false };
    }
  }

  /**
   * Complete OAuth authentication flow: Exchange Token -> Get Email -> Eligibility Check
   */
  async authenticate(code, port) {
    // 1. Exchange authorization code for token
    const tokenData = await this.exchangeCodeForToken(code, port);

    if (!tokenData.access_token) {
      throw new Error('Token exchange failed: access_token not obtained');
    }

    const account = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      timestamp: Date.now()
    };

    // 2. Get user email
    const email = await this.fetchUserEmail(account.access_token);
    if (email) {
      account.email = email;
      log.info('Got user email: ' + email);
    }

    // 3. Eligibility check and get projectId
    const { projectId, hasQuota } = await this.validateAndGetProjectId(account.access_token);
    account.projectId = projectId;
    account.hasQuota = hasQuota;
    account.enable = true;

    return account;
  }
}

export default new OAuthManager();
