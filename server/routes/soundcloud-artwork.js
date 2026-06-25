import { Router } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { streamTrackArtwork } from '../services/soundcloud.js';
import { validateSoundCloudTrackId } from '../utils/validate.js';

const router = Router();

router.get('/', async (req, res) => {
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
});

export default router;
