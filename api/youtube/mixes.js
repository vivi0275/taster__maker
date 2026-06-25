import { searchYouTubeMixes } from '../../server/services/youtube.js';
import { enforceRateLimit } from '../../server/utils/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'yt-mixes', max: 30, windowSec: 60 }))) {
    return;
  }

  const artist = req.query.artist?.trim();

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required.' });
  }

  const result = await searchYouTubeMixes(artist);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(result);
}
