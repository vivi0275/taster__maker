export function validateSoundCloudUserId(value) {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw new Error('Invalid soundcloudUserId.');
  }
  return str;
}

export function validateSoundCloudTrackId(value) {
  if (!value) {
    throw new Error('trackId is required.');
  }
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw new Error('Invalid trackId.');
  }
  return str;
}

export function validateSpotifyArtistId(value) {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  if (!/^[a-zA-Z0-9]{22}$/.test(str)) {
    throw new Error('Invalid spotifyArtistId.');
  }
  return str;
}

export function validateYouTubeVideoId(value) {
  if (!value) {
    throw new Error('videoId is required.');
  }
  const str = String(value).trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    throw new Error('Invalid videoId.');
  }
  return str;
}
