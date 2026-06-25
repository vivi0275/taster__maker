import { getBeyondRecommendations } from '../server/services/lastfm.js';
import { enforceRateLimit } from '../server/utils/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'beyond', max: 20, windowSec: 60 }))) {
    return;
  }

  const artist = req.query.artist?.trim();

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required.' });
  }

  let seedTracks = [];
  if (req.query.seeds) {
    try {
      seedTracks = JSON.parse(req.query.seeds);
      if (!Array.isArray(seedTracks)) seedTracks = [];
    } catch {
      seedTracks = [];
    }
  }

  const result = await getBeyondRecommendations(artist, seedTracks);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ query: artist, lastfm: result });
}
