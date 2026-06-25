import { Router } from 'express';
import { requestSoundCloudTokenDirect } from '../utils/soundcloud-auth.js';
import { isSharedTokenStoreConfigured } from '../utils/soundcloud-token-store.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await requestSoundCloudTokenDirect();

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Token-Store', isSharedTokenStoreConfigured() ? 'upstash' : 'memory');

    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    const status = err.message.includes('rate limit') ? 429 : 500;
    return res.status(status).json({ error: err.message || 'Token request failed.' });
  }
});

export default router;
