const API_BASE = '/api';

export async function searchArtist(artist, options = {}) {
  const params = new URLSearchParams({ artist });
  if (options.soundcloudUserId) params.set('soundcloudUserId', options.soundcloudUserId);
  if (options.spotifyArtistId) params.set('spotifyArtistId', options.spotifyArtistId);

  const response = await fetch(`${API_BASE}/search?${params}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Search failed. Please try again.');
  }

  return response.json();
}

export async function fetchBeyond(artist, seedTracks = []) {
  const params = new URLSearchParams({ artist });
  if (seedTracks.length > 0) {
    params.set(
      'seeds',
      JSON.stringify(seedTracks.map((t) => ({ title: t.title, artist: t.artist })))
    );
  }

  const response = await fetch(`${API_BASE}/beyond?${params}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Recommendations failed. Please try again.');
  }

  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) return null;
  return response.json();
}
