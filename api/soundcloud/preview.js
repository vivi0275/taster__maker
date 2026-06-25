import { getSoundCloudPreviewAudio } from '../../server/services/soundcloud.js';
import { enforceRateLimit } from '../../server/utils/rate-limit.js';
import { validateSoundCloudTrackId } from '../../server/utils/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'sc-preview', max: 40, windowSec: 60 }))) {
    return;
  }

  try {
    const trackId = validateSoundCloudTrackId(req.query.trackId?.trim());
    const { buffer, track, maxDuration } = await getSoundCloudPreviewAudio(trackId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Preview-Max-Duration', String(maxDuration));
    res.setHeader('X-Attribution-Uploader', track.user?.username ?? 'Unknown');
    res.setHeader('X-Attribution-Source', 'SoundCloud');

    return res.status(200).send(buffer);
  } catch (err) {
    if (err.message.includes('Invalid') || err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(err.message.includes('not available') ? 403 : 500).json({
      error: err.message || 'Preview failed.',
    });
  }
}
