import { Router } from 'express';
import { getBeyondRecommendations } from '../services/lastfm.js';

const router = Router();

router.get('/', async (req, res) => {
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
  res.json({ query: artist, lastfm: result });
});

export default router;
