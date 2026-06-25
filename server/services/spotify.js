const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const SEARCH_PAGE_SIZE = 10;
const MAX_PLAYLISTS = 8;
const MAX_PLAYLIST_TRACKS = 50;

let tokenCache = { token: null, expiresAt: 0 };

function getCredentials() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  };
}

function notConfigured() {
  return {
    status: 'error',
    tracks: [],
    playlists: [],
    artists: [],
    message: 'Spotify API not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env file.',
  };
}

async function getAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) return null;

  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (response.status === 429) {
    throw new Error('Spotify rate limit reached. Please try again in a moment.');
  }

  if (!response.ok) {
    throw new Error('Spotify authentication failed. Check your credentials.');
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function spotifyFetch(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 429) {
    throw new Error('Spotify rate limit reached. Please try again in a moment.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `Spotify API error (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      if (text) message += `: ${text.slice(0, 120)}`;
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

function namesMatch(a, b) {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  return left === right || left.includes(right) || right.includes(left);
}

function playlistRelevance(playlist, artistName) {
  const name = (playlist.name ?? '').toLowerCase();
  const owner = (playlist.owner?.display_name ?? '').toLowerCase();
  const artist = artistName.toLowerCase();

  let score = 0;
  if (namesMatch(owner, artistName)) score += 100;
  if (name === artist || name === `radio ${artist}`) score += 80;
  if (name.includes(artist)) score += 40;
  if (name.includes('radio') && name.includes(artist)) score += 30;
  if (name.includes('set') && name.includes(artist)) score += 20;
  if (owner.includes(artist)) score += 15;

  // Penalize unrelated homonyms (pegasus, etc.)
  if (artist.length >= 4 && name.includes(artist) === false && owner.includes(artist) === false) {
    score -= 50;
  }

  return score;
}

function normalizeTrack(track, meta, signal = 'playlist_track') {
  const artists = track.artists?.map((a) => a.name).join(', ') || 'Unknown artist';
  const url = track.external_urls?.spotify ?? (track.id ? `https://open.spotify.com/track/${track.id}` : null);
  const previewUrl = track.preview_url ?? null;

  return {
    id: `sp-${track.id}`,
    spotifyId: track.id,
    title: track.name,
    artist: artists,
    source: 'Spotify',
    url,
    meta,
    signal,
    attribution: artists,
    kind: 'track',
    previewUrl,
    previewable: Boolean(previewUrl),
    previewMaxDuration: 30,
    artworkUrl: track.album?.images?.[0]?.url ?? null,
  };
}

function normalizePlaylistCard(playlist, artistName) {
  const owner = playlist.owner?.display_name ?? 'Unknown curator';
  const ownedByArtist = namesMatch(owner, artistName);

  return {
    id: `sp-pl-${playlist.id}`,
    spotifyPlaylistId: playlist.id,
    title: playlist.name,
    artist: owner,
    source: 'Spotify',
    url: playlist.external_urls?.spotify,
    meta: ownedByArtist
      ? 'Public playlist by artist'
      : `Public playlist · curated by ${owner}`,
    attribution: owner,
    kind: 'playlist',
    signal: 'playlist',
  };
}

function mapArtistForPicker(artist) {
  const genres = artist.genres?.filter(Boolean) ?? [];
  const subtitle = genres.length > 0
    ? genres.slice(0, 3).join(', ')
    : 'Spotify artist profile';

  return {
    id: artist.id,
    name: artist.name,
    subtitle,
    genres,
    imageUrl: artist.images?.[0]?.url,
  };
}

function extractPlaylistItems(data) {
  const items = data.items ?? data.tracks?.items ?? [];
  const tracks = [];

  for (const entry of items) {
    const track = entry.track ?? entry.item ?? entry;
    if (!track || track.type !== 'track' || track.is_local) continue;
    tracks.push(track);
  }

  return tracks;
}

async function getPlaylistItems(playlistId, maxItems = MAX_PLAYLIST_TRACKS) {
  for (const endpoint of ['items', 'tracks']) {
    try {
      const data = await spotifyFetch(`/playlists/${playlistId}/${endpoint}`, {
        limit: Math.min(maxItems, 10),
        market: 'FR',
      });
      const tracks = extractPlaylistItems(data);
      if (tracks.length > 0) return tracks;

      // Paginate if first page empty but more exist
      if (data.next && tracks.length === 0) return [];

      if (tracks.length > 0 || !data.next) return tracks;
    } catch (err) {
      if (err.status === 403 || err.status === 401) return null;
      throw err;
    }
  }

  return null;
}

async function enrichPreviewUrls(tracks) {
  const needsPreview = tracks.filter((t) => t.spotifyId && !t.previewUrl);
  if (needsPreview.length === 0) return tracks;

  const previewById = new Map();

  for (let i = 0; i < needsPreview.length; i += 10) {
    const batch = needsPreview.slice(i, i + 10).map((t) => t.spotifyId);
    try {
      const data = await spotifyFetch('/tracks', { ids: batch.join(','), market: 'FR' });
      for (const track of data.tracks ?? []) {
        if (track?.id && track.preview_url) {
          previewById.set(track.id, track.preview_url);
        }
      }
    } catch {
      // Preview enrichment is best-effort
    }
  }

  return tracks.map((track) => {
    const previewUrl = track.previewUrl ?? previewById.get(track.spotifyId) ?? null;
    return {
      ...track,
      previewUrl,
      previewable: Boolean(previewUrl),
      previewMaxDuration: 30,
    };
  });
}

async function findArtistPlaylists(artistName) {
  const seen = new Set();
  const playlists = [];

  const queries = [
    artistName,
    `Radio ${artistName}`,
    `${artistName} official`,
    `${artistName} playlist`,
    `${artistName} set`,
  ];

  for (const query of queries) {
    const searchResult = await spotifyFetch('/search', {
      q: query,
      type: 'playlist',
      limit: 10,
    });

    for (const playlist of searchResult.playlists?.items ?? []) {
      if (!playlist?.id || seen.has(playlist.id)) continue;
      if (playlist.public === false) continue;

      const score = playlistRelevance(playlist, artistName);
      if (score <= 0) continue;

      seen.add(playlist.id);
      playlists.push({
        ...playlist,
        ownedByArtist: namesMatch(playlist.owner?.display_name ?? '', artistName),
        relevanceScore: score,
      });
    }

    if (playlists.length >= MAX_PLAYLISTS) break;
  }

  return playlists
    .sort((a, b) => b.relevanceScore - a.relevanceScore || Number(b.ownedByArtist) - Number(a.ownedByArtist))
    .slice(0, MAX_PLAYLISTS);
}

function dedupeTracks(tracks) {
  const seen = new Set();

  return tracks.filter((track) => {
    const key = track.spotifyId ?? track.id;
    if (!track.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchSpotify(artistName, artistId = null) {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) return notConfigured();

  try {
    let selectedArtist;

    if (artistId) {
      selectedArtist = await spotifyFetch(`/artists/${artistId}`);
    } else {
      const searchResult = await spotifyFetch('/search', {
        q: artistName,
        type: 'artist',
        limit: 5,
      });

      const artists = searchResult.artists?.items ?? [];

      if (artists.length === 0) {
        return {
          status: 'not_found',
          tracks: [],
          playlists: [],
          artists: [],
          message: `No Spotify artist found for "${artistName}".`,
        };
      }

      if (artists.length > 1) {
        return {
          status: 'ambiguous',
          tracks: [],
          playlists: [],
          artists: artists.map(mapArtistForPicker),
          message: `Multiple Spotify artists match "${artistName}". Pick the right profile.`,
        };
      }

      selectedArtist = artists[0];
    }

    const publicPlaylists = await findArtistPlaylists(selectedArtist.name);
    const playlistTrackResults = [];
    const playlistEmbedCards = [];
    let playlistTracksBlocked = false;

    for (const playlist of publicPlaylists) {
      const items = await getPlaylistItems(playlist.id);

      if (items === null) {
        playlistTracksBlocked = true;
        playlistEmbedCards.push(normalizePlaylistCard(playlist, selectedArtist.name));
        continue;
      }

      if (items.length === 0) {
        playlistEmbedCards.push(normalizePlaylistCard(playlist, selectedArtist.name));
        continue;
      }

      playlistTrackResults.push(
        ...items.map((t) =>
          normalizeTrack(t, `From playlist: ${playlist.name}`, 'playlist_track')
        )
      );
    }

    const playlistTracks = dedupeTracks(await enrichPreviewUrls(playlistTrackResults));

    if (publicPlaylists.length === 0) {
      return {
        status: 'success',
        tracks: [],
        playlists: [],
        artists: [],
        artistId: selectedArtist.id,
        artistName: selectedArtist.name,
        message: `No public Spotify playlists found for ${selectedArtist.name}. Liked songs are private. Try SoundCloud for their dig crate.`,
      };
    }

    if (playlistTracks.length === 0 && playlistEmbedCards.length === 0) {
      return {
        status: 'success',
        tracks: [],
        playlists: [],
        artists: [],
        artistId: selectedArtist.id,
        artistName: selectedArtist.name,
        message: `No Spotify playlist content found for ${selectedArtist.name}.`,
      };
    }

    let infoMessage = null;
    if (playlistTracksBlocked && playlistTracks.length === 0) {
      infoMessage =
        'Spotify no longer shares playlist track lists with third party apps (2026). Browse each playlist below in the embedded player. Tracks from all artists included.';
    } else if (playlistTracksBlocked && playlistTracks.length > 0) {
      infoMessage =
        'Some playlist track lists are blocked by Spotify. Use the embedded players below for the rest.';
    }

    return {
      status: 'success',
      tracks: playlistTracks,
      playlists: playlistEmbedCards,
      artists: [],
      artistId: selectedArtist.id,
      artistName: selectedArtist.name,
      message: infoMessage,
    };
  } catch (err) {
    return {
      status: 'error',
      tracks: [],
      playlists: [],
      artists: [],
      message: err.message || 'Failed to fetch Spotify data.',
    };
  }
}
