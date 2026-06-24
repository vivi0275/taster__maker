import { searchSoundCloud } from '../server/services/soundcloud.js';
import { searchSpotify } from '../server/services/spotify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const artist = req.query.artist?.trim();
  const soundcloudUserId = req.query.soundcloudUserId || null;
  const spotifyArtistId = req.query.spotifyArtistId || null;

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required.' });
  }

  const [soundcloud, spotify] = await Promise.all([
    searchSoundCloud(artist, soundcloudUserId),
    searchSpotify(artist, spotifyArtistId),
  ]);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ query: artist, soundcloud, spotify });
}
