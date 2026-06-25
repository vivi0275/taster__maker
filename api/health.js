import { getYouTubeApiKey, getLastfmApiKey } from '../server/utils/env.js';
import { isSharedTokenStoreConfigured } from '../server/utils/soundcloud-token-store.js';

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    soundcloud: Boolean(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET),
    spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    lastfm: Boolean(getLastfmApiKey()),
    youtube: Boolean(getYouTubeApiKey()),
    tokenStore: isSharedTokenStoreConfigured() ? 'upstash' : 'memory',
  });
}
