import { searchSoundCloud } from '../server/services/soundcloud.js';
import { searchSpotify } from '../server/services/spotify.js';
import { searchYouTubeMixes } from '../server/services/youtube.js';
import { enforceRateLimit } from '../server/utils/rate-limit.js';
import { validateSoundCloudUserId, validateSpotifyArtistId } from '../server/utils/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { name: 'search', max: 30, windowSec: 60 }))) {
    return;
  }

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

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ query: artist, soundcloud, spotify, youtube });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
}
