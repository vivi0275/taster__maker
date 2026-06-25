export function getYouTubeApiKey() {
  return process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_KEY || null;
}

export function getLastfmApiKey() {
  return process.env.LASTFM_API_KEY || process.env.LAST_KEY || null;
}
