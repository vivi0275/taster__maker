import { cleanTrackForSearch } from './tracklist-parser.js';
import { getSoundCloudAccessToken, requestSoundCloudTokenDirect } from '../utils/soundcloud-auth.js';

const API_BASE = 'https://api.soundcloud.com';

export { requestSoundCloudTokenDirect };

async function getAccessToken() {
  return getSoundCloudAccessToken();
}

function getCredentials() {
  return {
    clientId: process.env.SOUNDCLOUD_CLIENT_ID,
    clientSecret: process.env.SOUNDCLOUD_CLIENT_SECRET,
  };
}

function notConfigured() {
  return {
    status: 'error',
    tracks: [],
    artists: [],
    message:
      'SoundCloud API not configured. Add SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET to your environment variables.',
  };
}

async function scFetch(path, params = {}, attempt = 0) {
  const token = await getAccessToken();
  if (!token) throw new Error('SoundCloud authentication unavailable.');

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('linked_partitioning', 'true');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json; charset=utf-8',
      Authorization: `OAuth ${token}`,
    },
  });

  if (response.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return scFetch(path, params, attempt + 1);
  }

  if (response.status === 429) {
    throw new Error('SoundCloud rate limit reached. Please try again in a moment.');
  }

  if (response.status === 401 && attempt === 0) {
    const { invalidateSoundCloudAccessToken } = await import('../utils/soundcloud-auth.js');
    await invalidateSoundCloudAccessToken();
    return scFetch(path, params, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SoundCloud API error (${response.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  return response.json();
}

function extractCollection(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.collection)) return data.collection;
  return [];
}

async function fetchAllPages(path, params = {}, maxItems = 50) {
  const items = [];
  let nextPath = path;
  let nextParams = { ...params, limit: Math.min(params.limit ?? 50, 50) };

  while (items.length < maxItems) {
    const data = await scFetch(nextPath, nextParams);
    const batch = extractCollection(data);
    items.push(...batch);

    const nextHref = data?.next_href;
    if (!nextHref || batch.length === 0) break;

    const nextUrl = new URL(nextHref);
    nextPath = nextUrl.pathname;
    nextParams = Object.fromEntries(nextUrl.searchParams);
    delete nextParams.linked_partitioning;
  }

  return items.slice(0, maxItems);
}

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
}

function isThirdPartyUploader(uploader, profileUsername, profileDisplayName) {
  const uploaderNorm = normalizeUsername(uploader);
  const profileNorm = normalizeUsername(profileUsername);
  const displayNorm = normalizeUsername(profileDisplayName);
  if (!uploaderNorm || !profileNorm) return false;
  return uploaderNorm !== profileNorm && uploaderNorm !== displayNorm;
}

function resolveArtworkUrl(track) {
  const raw = track.artwork_url ?? track.user?.avatar_url ?? null;
  if (!raw) return null;
  return raw.replace('-large', '-t500x500').replace('-badge', '-t500x500');
}

function resolvePreviewMaxDuration(track) {
  if (track.access === 'blocked') return 0;
  if (track.access === 'preview') return 30;
  return 30;
}

function normalizeLikeTrack(item, profileUsername, profileDisplayName) {
  const track = item.track ?? item;
  if (!track || track.title == null) return null;

  const uploader = track.user?.username ?? track.user?.full_name ?? 'Unknown uploader';
  const likedAt = item.created_at ?? item.liked_at ?? track.created_at ?? null;

  return {
    id: `sc-${track.id}`,
    title: track.title,
    artist: uploader,
    source: 'SoundCloud',
    url: track.permalink_url ?? track.uri?.replace('soundcloud:tracks:', 'https://soundcloud.com/tracks/'),
    meta: 'Liked on SoundCloud',
    signal: 'liked',
    attribution: uploader,
    soundcloudTrackId: String(track.id),
    previewable: track.access !== 'blocked',
    previewMaxDuration: resolvePreviewMaxDuration(track),
    likedAt,
    artworkUrl: resolveArtworkUrl(track),
    thirdPartyDiscovery: false,
  };
}

function normalizeRepostTrack(item, profileUsername, profileDisplayName) {
  const track = item.track ?? item;
  if (!track || track.title == null) return null;

  const uploader = track.user?.username ?? track.user?.full_name ?? 'Unknown uploader';
  const thirdParty = isThirdPartyUploader(uploader, profileUsername, profileDisplayName);

  return {
    id: `sc-repost-${track.id}`,
    title: track.title,
    artist: uploader,
    source: 'SoundCloud',
    url: track.permalink_url ?? track.uri?.replace('soundcloud:tracks:', 'https://soundcloud.com/tracks/'),
    meta: thirdParty ? 'Reposted · discovery from another artist' : 'Reposted on SoundCloud',
    signal: 'reposted',
    attribution: uploader,
    soundcloudTrackId: String(track.id),
    previewable: track.access !== 'blocked',
    previewMaxDuration: resolvePreviewMaxDuration(track),
    artworkUrl: resolveArtworkUrl(track),
    thirdPartyDiscovery: thirdParty,
  };
}

async function searchUsers(artistName) {
  try {
    const data = await scFetch('/users', { q: artistName, limit: 3 });
    return extractCollection(data);
  } catch {
    const data = await scFetch('/search/users', { q: artistName, limit: 3 });
    return extractCollection(data);
  }
}

async function searchTracks(query, limit = 10) {
  const data = await scFetch('/tracks', { q: query, limit });
  return extractCollection(data);
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^free\s*dl\s*\|\s*/i, '')
    .replace(/\s*\((?:unreleased|extended(?:\s+ver\.?|\s+mix)?|original\s+mix|acapella|a\s+capella)\)\s*/gi, ' ')
    .replace(/\s*\[(?:unreleased|extended(?:\s+mix)?|original\s+mix|acapella)\]\s*/gi, ' ')
    .replace(/\s*\(.*?remix.*?\)\s*/gi, ' ')
    .replace(/\s*\(.*?edit.*?\)\s*/gi, ' ')
    .replace(/\s*-\s*original mix\s*/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseEmbeddedArtistTitle(trackTitle) {
  const cleaned = String(trackTitle ?? '').replace(/^free\s*dl\s*\|\s*/i, '').trim();
  const match = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (!match) return { artist: null, title: cleaned };
  return { artist: match[1].trim(), title: match[2].trim() };
}

function tokenOverlap(a, b) {
  const tokensA = new Set(normalizeForMatch(a).split(' ').filter((t) => t.length > 1));
  const tokensB = new Set(normalizeForMatch(b).split(' ').filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function scoreTrackMatch(candidate, title, artist) {
  const embedded = parseEmbeddedArtistTitle(candidate.title);
  const candTitle = normalizeForMatch(embedded.title);
  const candArtistFromTitle = normalizeForMatch(embedded.artist);
  const candArtist = normalizeForMatch(candidate.user?.username ?? candidate.user?.full_name ?? '');
  const candFull = normalizeForMatch(candidate.title);
  const wantTitle = normalizeForMatch(title);
  const wantArtist = normalizeForMatch(artist);

  let score = 0;

  if (candTitle === wantTitle) score += 0.45;
  else if (candTitle.includes(wantTitle) || wantTitle.includes(candTitle)) score += 0.3;
  else score += tokenOverlap(candTitle, wantTitle) * 0.35;

  if (wantTitle && candFull.includes(wantTitle)) score += 0.1;

  const artistCandidates = [candArtist, candArtistFromTitle].filter(Boolean);
  if (wantArtist && artistCandidates.length > 0) {
    const artistHit = artistCandidates.some(
      (a) => a === wantArtist || a.includes(wantArtist) || wantArtist.includes(a)
    );
    const artistTokenHit = artistCandidates.some((a) => tokenOverlap(a, wantArtist) >= 0.5);
    if (artistHit) score += 0.35;
    else if (artistTokenHit) score += 0.2;
    else if (candFull.includes(wantArtist)) score += 0.15;
  }

  const isDerivative = /\b(remix|edit|bootleg|mashup|flip|rework|vip)\b/i.test(candidate.title);
  const wantsDerivative = /\b(remix|edit|bootleg|mashup|flip|rework|vip)\b/i.test(title);
  if (isDerivative && !wantsDerivative) score -= 0.12;

  return Math.max(0, Math.min(score, 1));
}

function normalizeMatchedTrack(track, parsed, confidence, status) {
  const uploader = track.user?.username ?? track.user?.full_name ?? parsed.artist;

  return {
    timestamp: parsed.timestamp,
    parsedTitle: parsed.title,
    parsedArtist: parsed.artist,
    rawLine: parsed.rawLine,
    matchStatus: status,
    confidence,
    id: `sc-mix-${track.id}`,
    title: track.title,
    artist: uploader,
    source: 'SoundCloud',
    url: track.permalink_url ?? track.uri?.replace('soundcloud:tracks:', 'https://soundcloud.com/tracks/'),
    meta: `From mix · ${parsed.artist} - ${parsed.title}`,
    signal: 'from_mix',
    attribution: uploader,
    soundcloudTrackId: String(track.id),
    previewable: track.access !== 'blocked',
    previewMaxDuration: resolvePreviewMaxDuration(track),
    artworkUrl: resolveArtworkUrl(track),
    kind: 'track',
  };
}


export async function matchTrackOnSoundCloud(title, artist) {
  const cleaned = cleanTrackForSearch(title, artist);
  const searchTitle = cleaned.title || title;
  const searchArtist = cleaned.artist || artist;

  const queries = [
    `${searchArtist} ${searchTitle}`,
    `${searchTitle} ${searchArtist}`,
    searchTitle,
  ].filter(Boolean);

  let best = null;
  let bestScore = 0;

  for (const q of queries) {
    const results = await searchTracks(q, 10);
    for (const item of results) {
      const track = item.track ?? item;
      if (!track?.title || track.access === 'blocked') continue;

      const score = scoreTrackMatch(track, searchTitle, searchArtist);
      if (score > bestScore) {
        bestScore = score;
        best = track;
      }
    }
    if (bestScore >= 0.65) break;
  }

  if (!best || bestScore < 0.28) {
    return {
      matchStatus: 'not_found',
      confidence: bestScore,
      parsedTitle: title,
      parsedArtist: artist,
      source: 'SoundCloud',
      signal: 'from_mix',
      kind: 'track',
    };
  }

  const status = bestScore >= 0.65 ? 'matched' : 'probable';
  return normalizeMatchedTrack(
    best,
    { title, artist, timestamp: null, rawLine: `${artist} - ${title}` },
    bestScore,
    status
  );
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await mapper(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function matchTracksOnSoundCloud(parsedTracks, concurrency = 5) {
  return mapWithConcurrency(parsedTracks, concurrency, async (parsed) => {
    try {
      const match = await matchTrackOnSoundCloud(parsed.title, parsed.artist);
      return {
        ...match,
        timestamp: parsed.timestamp,
        rawLine: parsed.rawLine,
        parsedTitle: parsed.title,
        parsedArtist: parsed.artist,
      };
    } catch {
      return {
        matchStatus: 'not_found',
        confidence: 0,
        timestamp: parsed.timestamp,
        rawLine: parsed.rawLine,
        parsedTitle: parsed.title,
        parsedArtist: parsed.artist,
        source: 'SoundCloud',
        signal: 'from_mix',
        kind: 'track',
      };
    }
  });
}

export async function getTrackArtwork(trackId, trackUrl = null) {
  if (trackId) {
    try {
      const track = await scFetch(`/tracks/${trackId}`);
      const url = resolveArtworkUrl(track);
      if (url) return url;
    } catch {
      // fall through to oEmbed
    }
  }

  if (trackUrl) {
    return getArtworkFromOEmbed(trackUrl);
  }

  return null;
}

async function getArtworkFromOEmbed(trackUrl) {
  const response = await fetch(
    `https://soundcloud.com/oembed?url=${encodeURIComponent(trackUrl)}&format=json`
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.thumbnail_url ?? null;
}

export async function streamTrackArtwork(trackId, trackUrl = null) {
  const artworkUrl = await getTrackArtwork(trackId, trackUrl);
  if (!artworkUrl) return null;

  const response = await fetch(artworkUrl);
  if (!response.ok) return null;

  return {
    response,
    contentType: response.headers.get('content-type') ?? 'image/jpeg',
  };
}

async function readWebStreamWithLimit(body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;

      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(Buffer.from(value.subarray(0, remaining)));
        total += remaining;
        break;
      }

      chunks.push(Buffer.from(value));
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks);
}

export async function getSoundCloudPreviewStream(trackId) {
  const track = await scFetch(`/tracks/${trackId}`);

  if (track.access === 'blocked') {
    throw new Error('This track is not available for preview on SoundCloud.');
  }

  let streams;
  try {
    streams = await scFetch(`/tracks/${trackId}/streams`);
  } catch {
    streams = {};
  }

  const previewMp3 = streams.preview_mp3_128_url;
  const fullMp3 = streams.http_mp3_128_url;
  const usesPreviewClip = Boolean(previewMp3);

  const streamUrl = previewMp3 || fullMp3;
  if (!streamUrl) {
    throw new Error('No preview stream available for this track.');
  }

  const maxDuration = 30;

  const token = await getAccessToken();
  const fullUrl = streamUrl.startsWith('http') ? streamUrl : `${API_BASE}${streamUrl}`;

  const response = await fetch(fullUrl, {
    headers: {
      Accept: '*/*',
      Authorization: `OAuth ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to load SoundCloud preview stream.');
  }

  return {
    response,
    track,
    maxDuration,
    usesPreviewClip,
  };
}

export async function getSoundCloudPreviewAudio(trackId) {
  const { response, track, maxDuration, usesPreviewClip } = await getSoundCloudPreviewStream(trackId);

  if (!response.body) {
    throw new Error('Preview stream unavailable.');
  }

  const maxBytes = usesPreviewClip ? 2 * 1024 * 1024 : 512 * 1024;
  const buffer = await readWebStreamWithLimit(response.body, maxBytes);

  if (!buffer.length) {
    throw new Error('Preview stream unavailable.');
  }

  return { buffer, track, maxDuration };
}

export async function searchSoundCloud(artistName, userId = null) {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) return notConfigured();

  try {
    let selectedUser;

    if (userId) {
      selectedUser = await scFetch(`/users/${userId}`);
    } else {
      const users = await searchUsers(artistName);

      if (!users || users.length === 0) {
        return {
          status: 'not_found',
          tracks: [],
          artists: [],
          message: `No SoundCloud user found for "${artistName}".`,
        };
      }

      if (users.length > 1) {
        return {
          status: 'ambiguous',
          tracks: [],
          artists: users.map((u) => ({
            id: u.id,
            name: u.full_name || u.username,
            username: u.username,
            avatarUrl: u.avatar_url,
            trackCount: u.track_count,
            followers: u.followers_count,
          })),
          message: `Multiple SoundCloud users match "${artistName}". Pick the right profile.`,
        };
      }

      selectedUser = users[0];
    }

    const profileUsername = selectedUser.username;
    const profileDisplayName = selectedUser.full_name || selectedUser.username;

    const likes = await fetchAllPages(`/users/${selectedUser.id}/likes/tracks`, { limit: 50 }).catch(() => []);

    let repostTracks = [];
    try {
      const reposts = await fetchAllPages(`/users/${selectedUser.id}/reposts/tracks`, { limit: 50 });
      repostTracks = reposts
        .map((item) => normalizeRepostTrack(item, profileUsername, profileDisplayName))
        .filter(Boolean);
    } catch {
      // Reposts endpoint may not be available for all apps yet
    }

    const likeTracks = likes
      .map((item) => normalizeLikeTrack(item, profileUsername, profileDisplayName))
      .filter(Boolean)
      .sort((a, b) => {
        if (!a.likedAt && !b.likedAt) return 0;
        if (!a.likedAt) return 1;
        if (!b.likedAt) return -1;
        return new Date(b.likedAt) - new Date(a.likedAt);
      });

    const seen = new Set();
    const tracks = [...likeTracks, ...repostTracks].filter((t) => {
      if (!t.url || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const displayName = selectedUser.full_name || selectedUser.username;

    if (tracks.length === 0) {
      return {
        status: 'success',
        tracks: [],
        artists: [],
        userId: String(selectedUser.id),
        artistName: displayName,
        message: `No public likes or reposts found for ${displayName} on SoundCloud.`,
      };
    }

    return {
      status: 'success',
      tracks,
      artists: [],
      userId: String(selectedUser.id),
      artistName: displayName,
      message: null,
    };
  } catch (err) {
    return {
      status: 'error',
      tracks: [],
      artists: [],
      message: err.message || 'Failed to fetch SoundCloud data.',
    };
  }
}
