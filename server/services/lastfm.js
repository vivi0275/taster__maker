import { getLastfmApiKey } from '../utils/env.js';

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

function getApiKey() {
  return getLastfmApiKey();
}

function notConfigured() {
  return {
    status: 'error',
    similarArtists: [],
    similarTracks: [],
    message: 'Last.fm API not configured. Add LASTFM_API_KEY to your environment variables.',
  };
}

async function lastfmFetch(params) {
  const apiKey = getApiKey();
  const url = new URL(API_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());

  if (response.status === 429) {
    throw new Error('Last.fm rate limit reached. Please try again in a moment.');
  }

  if (!response.ok) {
    throw new Error(`Last.fm API error (${response.status}).`);
  }

  const data = await response.json();

  if (data.error) {
    if (data.error === 6) return null;
    throw new Error(data.message || `Last.fm error (${data.error}).`);
  }

  return data;
}

function trackUrl(artist, track) {
  const a = encodeURIComponent(artist).replace(/%20/g, '+');
  const t = encodeURIComponent(track).replace(/%20/g, '+');
  return `https://www.last.fm/music/${a}/_/${t}`;
}

function artistUrl(name) {
  return `https://www.last.fm/music/${encodeURIComponent(name).replace(/%20/g, '+')}`;
}

function extractImage(images) {
  if (!Array.isArray(images)) return null;
  return images.find((img) => img.size === 'large')?.['#text']
    || images.find((img) => img.size === 'medium')?.['#text']
    || images[images.length - 1]?.['#text']
    || null;
}

function normalizeSimilarArtist(artist) {
  if (!artist?.name) return null;
  const match = parseFloat(artist.match);
  return {
    id: `lfm-artist-${artist.name}`,
    name: artist.name,
    source: 'Last.fm',
    url: artist.url || artistUrl(artist.name),
    imageUrl: extractImage(artist.image),
    meta: Number.isFinite(match) ? `${Math.round(match * 100)}% match` : 'Similar artist',
    matchScore: match || 0,
  };
}

function normalizeSimilarTrack(track, seedLabel) {
  const artistName = track.artist?.name ?? track.artist ?? 'Unknown artist';
  if (!track.name) return null;

  const match = parseFloat(track.match);

  return {
    id: `lfm-track-${artistName}-${track.name}`,
    title: track.name,
    artist: artistName,
    source: 'Last.fm',
    url: track.url || trackUrl(artistName, track.name),
    meta: seedLabel
      ? `Similar to "${seedLabel}"${Number.isFinite(match) ? ` · ${Math.round(match * 100)}% match` : ''}`
      : Number.isFinite(match)
        ? `${Math.round(match * 100)}% match`
        : 'Recommended by Last.fm',
    attribution: artistName,
    signal: 'similar',
    matchScore: match || 0,
  };
}

async function resolveArtist(artistName) {
  const data = await lastfmFetch({ method: 'artist.search', artist: artistName, limit: 5 });
  const artists = data?.results?.artistmatches?.artist ?? [];
  const list = Array.isArray(artists) ? artists : artists ? [artists] : [];

  if (list.length === 0) return null;

  const exact = list.find((a) => a.name.toLowerCase() === artistName.toLowerCase());
  return exact ?? list[0];
}

async function getSimilarArtists(artistName, limit = 12) {
  const data = await lastfmFetch({ method: 'artist.getSimilar', artist: artistName, limit });
  const artists = data?.similarartists?.artist ?? [];
  const list = Array.isArray(artists) ? artists : artists ? [artists] : [];
  return list.map(normalizeSimilarArtist).filter(Boolean);
}

async function getSimilarTracksForSeed(title, artist, limit = 8) {
  const data = await lastfmFetch({
    method: 'track.getSimilar',
    track: title,
    artist,
    limit,
    autocorrect: 1,
  });

  const tracks = data?.similartracks?.track ?? [];
  const list = Array.isArray(tracks) ? tracks : tracks ? [tracks] : [];
  const seedLabel = `${title} — ${artist}`;

  return list
    .map((t) => normalizeSimilarTrack(t, seedLabel))
    .filter(Boolean);
}

async function getLovedTracks(username, limit = 10) {
  const data = await lastfmFetch({ method: 'user.getLovedTracks', user: username, limit });
  if (!data) return [];

  const tracks = data?.lovedtracks?.track ?? [];
  const list = Array.isArray(tracks) ? tracks : tracks ? [tracks] : [];

  return list.map((t) => ({
    title: t.name,
    artist: t.artist?.name ?? t.artist ?? '',
  })).filter((t) => t.title && t.artist);
}

async function getTopTracks(artistName, limit = 5) {
  const data = await lastfmFetch({ method: 'artist.getTopTracks', artist: artistName, limit });
  const tracks = data?.toptracks?.track ?? [];
  const list = Array.isArray(tracks) ? tracks : tracks ? [tracks] : [];

  return list.map((t) => ({
    title: t.name,
    artist: t.artist?.name ?? artistName,
  })).filter((t) => t.title);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function getBeyondRecommendations(artistName, seedTracks = []) {
  if (!getApiKey()) return notConfigured();

  try {
    const resolved = await resolveArtist(artistName);

    if (!resolved) {
      return {
        status: 'not_found',
        similarArtists: [],
        similarTracks: [],
        artistName,
        message: `No Last.fm artist found for "${artistName}".`,
      };
    }

    const canonicalName = resolved.name;

    const similarArtists = await getSimilarArtists(canonicalName, 12);

    let seeds = seedTracks
      .filter((t) => t.title && t.artist)
      .slice(0, 4)
      .map((t) => ({ title: t.title, artist: t.artist }));

    if (seeds.length === 0) {
      const loved = await getLovedTracks(canonicalName.toLowerCase().replace(/\s+/g, ''), 5).catch(() => []);
      seeds = loved.length > 0 ? loved.slice(0, 4) : await getTopTracks(canonicalName, 4);
    }

    const trackBatches = await Promise.all(
      seeds.map((seed) =>
        getSimilarTracksForSeed(seed.title, seed.artist, 6).catch(() => [])
      )
    );

    const similarTracks = dedupeById(
      trackBatches
        .flat()
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 18)
    );

    const sortedArtists = similarArtists
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 12);

    if (sortedArtists.length === 0 && similarTracks.length === 0) {
      return {
        status: 'success',
        similarArtists: [],
        similarTracks: [],
        artistName: canonicalName,
        seedsUsed: seeds.length,
        message: `No recommendations found for ${canonicalName} on Last.fm.`,
      };
    }

    return {
      status: 'success',
      similarArtists: sortedArtists,
      similarTracks,
      artistName: canonicalName,
      seedsUsed: seeds.length,
      message: null,
    };
  } catch (err) {
    return {
      status: 'error',
      similarArtists: [],
      similarTracks: [],
      message: err.message || 'Failed to fetch Last.fm recommendations.',
    };
  }
}
