import { Router } from 'express';
import { searchSoundCloud } from '../services/soundcloud.js';
import { searchSpotify } from '../services/spotify.js';
import { searchYouTubeMixes } from '../services/youtube.js';
import { validateSoundCloudUserId, validateSpotifyArtistId } from '../utils/validate.js';

const router = Router();

router.get('/', async (req, res) => {
  const artist = req.query.artist?.trim();

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required.' });
  }

  try {
    const soundcloudUserId = validateSoundCloudUserId(req.query.soundcloudUserId);
    const spotifyArtistId = validateSpotifyArtistId(req.query.spotifyArtistId);

    const [soundcloud, spotify, youtube] = await Promise.all([
      searchSoundCloud(artist, soundcloudUserId),
      searchSpotify(artist, spotifyArtistId),
      searchYouTubeMixes(artist),
    ]);

    res.json({
      query: artist,
      soundcloud,
      spotify,
      youtube,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
});

export default router;
