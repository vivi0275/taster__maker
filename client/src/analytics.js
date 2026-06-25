import posthog from 'posthog-js';

const QUALIFIED_KEY = 'tm_discovery_qualified';

let initialized = false;

function isEnabled() {
  return initialized && Boolean(import.meta.env.VITE_POSTHOG_KEY);
}

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key || initialized) return;

  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  });

  initialized = true;
}

function capture(event, properties = {}) {
  if (!isEnabled()) return;
  posthog.capture(event, properties);
}

/** North Star: first preview or outbound click in a browser session */
function qualifyDiscoverySession(properties) {
  if (!isEnabled()) return;
  if (sessionStorage.getItem(QUALIFIED_KEY)) return;

  sessionStorage.setItem(QUALIFIED_KEY, '1');
  capture('discovery_session_qualified', properties);
}

export function trackSearchCompleted({
  artist,
  soundcloudCount,
  spotifyCount,
  youtubeCount = 0,
  trailDepth,
  fromCache = false,
}) {
  capture('search_completed', {
    artist,
    soundcloud_count: soundcloudCount,
    spotify_count: spotifyCount,
    youtube_count: youtubeCount,
    trail_depth: trailDepth,
    from_cache: fromCache,
  });

  if (youtubeCount > 0) {
    capture('youtube_mixes_shown', { artist, mix_count: youtubeCount });
  }
}

export function trackYouTubeDigStarted({ videoId, artist }) {
  capture('youtube_dig_started', { video_id: videoId, artist });
}

export function trackYouTubeDigCompleted({
  videoId,
  artist,
  tracklistSource,
  trackCount,
  matchedCount,
}) {
  capture('youtube_dig_completed', {
    video_id: videoId,
    artist,
    tracklist_source: tracklistSource,
    track_count: trackCount,
    matched_count: matchedCount,
  });
}

export function trackYouTubeScMatchClick({ videoId, artist, trackId, destination }) {
  capture('youtube_sc_match_click', {
    video_id: videoId,
    artist,
    track_id: trackId,
    destination,
  });
}

export function trackPreviewStarted({ trackId, artist, signal, platform = 'SoundCloud' }) {
  capture('preview_started', { track_id: trackId, artist, signal, platform });
  qualifyDiscoverySession({
    trigger: 'preview',
    artist,
    track_id: trackId,
    signal,
    platform,
  });
}

export function trackOutboundClick({ platform, signal, artist, destination }) {
  capture('outbound_click', { platform, signal, artist, destination });
  qualifyDiscoverySession({
    trigger: 'outbound_click',
    platform,
    artist,
    signal,
    destination,
  });
}

export function trackTrailExtended({ artist, depth }) {
  capture('trail_extended', { artist, depth });
}

export function trackGoBeyond({ artist, seedCount }) {
  capture('go_beyond_clicked', { artist, seed_count: seedCount });
}

export function trackDiscoverArtist({ fromArtist, toArtist, depth, source = 'lastfm' }) {
  capture('discover_artist_clicked', {
    from_artist: fromArtist,
    to_artist: toArtist,
    depth,
    source,
  });
}

export function trackSaved({ trackId, artist, signal, platform = 'SoundCloud', contextArtist }) {
  capture('track_saved', {
    track_id: trackId,
    artist,
    signal,
    platform,
    context_artist: contextArtist,
  });
}
