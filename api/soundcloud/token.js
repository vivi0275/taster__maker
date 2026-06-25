import { requestSoundCloudTokenDirect } from '../../server/services/soundcloud.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await requestSoundCloudTokenDirect();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=3000, stale-while-revalidate=86400');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=3000');

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
