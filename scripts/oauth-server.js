import http from 'http';
import { URL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import log from '../src/utils/logger.js';
import tokenManager from '../src/auth/token_manager.js';
import oauthManager from '../src/auth/oauth_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACCOUNTS_FILE = path.join(__dirname, '..', 'data', 'accounts.json');

const server = http.createServer((req, res) => {
  const port = server.address().port;
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === '/oauth-callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (code) {
      log.info('Auth code received, exchanging for Token...');
      oauthManager.authenticate(code, port).then(account => {
        const result = tokenManager.addToken(account);
        if (result.success) {
          log.info(`Token saved to ${ACCOUNTS_FILE}`);
          if (!account.hasQuota) {
            log.warn('Account not eligible, auto-generated random ProjectId');
          }
        } else {
          log.error('Failed to save Token:', result.message);
        }

        const statusMsg = account.hasQuota ? '' : '<p style="color: orange;">⚠️ Account not eligible, auto-generated random ProjectId</p>';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Authorization Successful!</h1><p>Token saved, you can close this page.</p>${statusMsg}`);
        setTimeout(() => server.close(), 1000);
      }).catch(err => {
        log.error('Authentication failed:', err.message);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Authentication Failed</h1><p>Check console for error details</p>');
        setTimeout(() => server.close(), 1000);
      });
    } else {
      log.error('Authorization failed:', error || 'Auth code not received');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Authorization Failed</h1>');
      setTimeout(() => server.close(), 1000);
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(0, () => {
  const port = server.address().port;
  const authUrl = oauthManager.generateAuthUrl(port);
  log.info(`Server running at http://localhost:${port}`);
  log.info('Please open the following link in your browser to login:');
  console.log(`\n${authUrl}\n`);
  log.info('Waiting for authorization callback...');
});
