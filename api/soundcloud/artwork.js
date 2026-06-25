import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { streamTrackArtwork } from '../../server/services/soundcloud.js';
import { enforceRateLimit } from '../../server/utils/rate-limit.js';
import { validateSoundCloudTrackId } from '../../server/utils/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'sc-artwork', max: 60, windowSec: 60 }))) {
    return;
  }

  const trackUrl = req.query.url?.trim() || null;
  let trackId = null;

  try {
    if (req.query.trackId?.trim()) {
      trackId = validateSoundCloudTrackId(req.query.trackId.trim());
    }

    if (!trackId && !trackUrl) {
      return res.status(400).json({ error: 'trackId or url is required.' });
    }

    const stream = await streamTrackArtwork(trackId, trackUrl);
    if (!stream) {
      return res.status(404).json({ error: 'No artwork for this track.' });
    }

    res.setHeader('Content-Type', stream.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (stream.response.body) {
      const nodeStream = Readable.fromWeb(stream.response.body);
      await pipeline(nodeStream, res);
      return;
    }

    return res.status(502).json({ error: 'Artwork stream unavailable.' });
  } catch (err) {
    if (err.message.includes('Invalid') || err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Artwork lookup failed.' });
  }
}
