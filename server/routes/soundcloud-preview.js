import { Router } from 'express';
import { getSoundCloudPreviewAudio } from '../services/soundcloud.js';

const router = Router();

router.get('/', async (req, res) => {
  const trackId = req.query.trackId?.trim();

  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required.' });
  }

  try {
    const { buffer, track, maxDuration } = await getSoundCloudPreviewAudio(trackId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Preview-Max-Duration', String(maxDuration));
    res.setHeader('X-Attribution-Uploader', track.user?.username ?? 'Unknown');
    res.setHeader('X-Attribution-Source', 'SoundCloud');

    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(err.message.includes('not available') ? 403 : 500).json({
      error: err.message || 'Preview failed.',
    });
  }
});

export default router;
