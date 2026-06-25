import { requestSoundCloudTokenDirect } from '../../server/utils/soundcloud-auth.js';
import { isSharedTokenStoreConfigured } from '../../server/utils/soundcloud-token-store.js';
import { enforceRateLimit } from '../../server/utils/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'sc-token', max: 10, windowSec: 60 }))) {
    return;
  }

  try {
    const data = await requestSoundCloudTokenDirect();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Token-Store', isSharedTokenStoreConfigured() ? 'upstash' : 'memory');

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const status = err.message.includes('rate limit') ? 429 : 500;
    return res.status(status).json({ error: err.message || 'Token request failed.' });
  }
}
