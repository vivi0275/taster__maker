const PREFIX = 'tm_search_v2_';
const TTL_MS = 60 * 60 * 1000;

function cacheKey(artist, soundcloudUserId, spotifyArtistId) {
  return `${PREFIX}${artist.toLowerCase()}::${soundcloudUserId ?? ''}::${spotifyArtistId ?? ''}`;
}

export function resolveCacheIds(soundcloudUserId, spotifyArtistId, data) {
  return {
    soundcloudUserId: soundcloudUserId ?? data?.soundcloud?.userId ?? null,
    spotifyArtistId: spotifyArtistId ?? data?.spotify?.artistId ?? null,
  };
}

function isStalePayload(data) {
  const tracks = data?.soundcloud?.tracks ?? [];
  if (!tracks.length) return false;
  return tracks.some((t) => t.source === 'SoundCloud' && t.soundcloudTrackId && !t.artworkUrl);
}

function readCacheEntry(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS || isStalePayload(data)) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function getCachedSearch(artist, soundcloudUserId, spotifyArtistId) {
  const primary = readCacheEntry(cacheKey(artist, soundcloudUserId, spotifyArtistId));
  if (primary) return primary;

  if (!soundcloudUserId && !spotifyArtistId) {
    const prefix = `${PREFIX}${artist.toLowerCase()}::`;
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        const match = readCacheEntry(key);
        if (match) return match;
      }
    }
  }

  return null;
}

export function setCachedSearch(artist, soundcloudUserId, spotifyArtistId, data) {
  try {
    const ids = resolveCacheIds(soundcloudUserId, spotifyArtistId, data);
    sessionStorage.setItem(
      cacheKey(artist, ids.soundcloudUserId, ids.spotifyArtistId),
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // quota exceeded — ignore
  }
}
