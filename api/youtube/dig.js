import { digYouTubeMix } from '../../server/services/youtube.js';
import { enforceRateLimit } from '../../server/utils/rate-limit.js';
import { validateYouTubeVideoId } from '../../server/utils/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'yt-dig', max: 15, windowSec: 60 }))) {
    return;
  }

  try {
    const videoId = validateYouTubeVideoId(req.query.videoId?.trim());
    const result = await digYouTubeMix(videoId);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
}
