import { extractTracklist } from './tracklist-parser.js';
import { matchTracksOnSoundCloud } from './soundcloud.js';
import { getYouTubeApiKey } from '../utils/env.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_MIXES = 8;
const MAX_TRACKS_PER_MIX = 25;
const MIXES_CACHE_TTL_MS = 60 * 60 * 1000;

const mixesCache = new Map();

function getMixesCacheKey(artistName) {
  return artistName.toLowerCase().trim();
}

function getCachedMixes(artistName) {
  const key = getMixesCacheKey(artistName);
  const entry = mixesCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MIXES_CACHE_TTL_MS) {
    mixesCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedMixes(artistName, data) {
  mixesCache.set(getMixesCacheKey(artistName), { data, ts: Date.now() });
}

function getApiKey() {
  return getYouTubeApiKey();
}

function notConfigured() {
  return {
    status: 'error',
    mixes: [],
    message: 'YouTube API not configured. Add YOUTUBE_API_KEY to your environment variables.',
  };
}

async function ytFetch(path, params = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());

  if (response.status === 403) {
    const text = await response.text().catch(() => '');
    if (text.includes('quotaExceeded')) {
      throw new Error('YouTube API daily quota exceeded. Try again tomorrow.');
    }
    throw new Error('YouTube API access denied. Check your API key.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`YouTube API error (${response.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  return response.json();
}

function namesMatch(a, b) {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function parseDuration(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const total = h * 3600 + min * 60 + s;
  if (total < 600) return null;
  return total;
}

function normalizeMix(item, details = null) {
  const id = item.id?.videoId ?? item.id;
  const snippet = details?.snippet ?? item.snippet;
  const content = details?.contentDetails;

  return {
    videoId: id,
    title: snippet?.title ?? 'Untitled',
    channelTitle: snippet?.channelTitle ?? 'Unknown channel',
    thumbnailUrl:
      snippet?.thumbnails?.medium?.url ??
      snippet?.thumbnails?.default?.url ??
      null,
    publishedAt: snippet?.publishedAt ?? null,
    durationSeconds: parseDuration(content?.duration),
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

function isRelevantMix(mix, artistName) {
  const artist = artistName.toLowerCase();
  const title = mix.title.toLowerCase();
  const channel = mix.channelTitle.toLowerCase();

  if (namesMatch(title, artistName) || namesMatch(channel, artistName)) return true;

  const mixKeywords = ['live', 'set', 'mix', 'boiler room', 'essential mix', 'podcast', 'dj'];
  const hasKeyword = mixKeywords.some((k) => title.includes(k));
  const mentionsArtist = title.includes(artist) || channel.includes(artist);

  return hasKeyword && mentionsArtist;
}

export async function searchYouTubeMixes(artistName) {
  if (!getApiKey()) return notConfigured();

  const cached = getCachedMixes(artistName);
  if (cached) return cached;

  try {
    const query = `${artistName} live set|DJ mix|boiler room|live`;
    const searchData = await ytFetch('/search', {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: MAX_MIXES,
      order: 'relevance',
      videoDuration: 'long',
    });

    const items = searchData?.items ?? [];
    if (items.length === 0) {
      const empty = {
        status: 'success',
        mixes: [],
        message: `No YouTube mixes found for "${artistName}".`,
      };
      setCachedMixes(artistName, empty);
      return empty;
    }

    const videoIds = items.map((i) => i.id?.videoId).filter(Boolean);
    const detailsData = await ytFetch('/videos', {
      part: 'snippet,contentDetails',
      id: videoIds.join(','),
    });

    const detailsById = new Map((detailsData?.items ?? []).map((v) => [v.id, v]));

    const mixes = items
      .map((item) => {
        const id = item.id?.videoId;
        return normalizeMix(item, detailsById.get(id));
      })
      .filter((mix) => isRelevantMix(mix, artistName))
      .slice(0, MAX_MIXES);

    if (mixes.length === 0) {
      const empty = {
        status: 'success',
        mixes: [],
        message: `No relevant YouTube live sets found for "${artistName}".`,
      };
      setCachedMixes(artistName, empty);
      return empty;
    }

    const result = {
      status: 'success',
      mixes,
      message: null,
    };
    setCachedMixes(artistName, result);
    return result;
  } catch (err) {
    const result = {
      status: 'error',
      mixes: [],
      message: err.message || 'Failed to fetch YouTube mixes.',
    };
    return result;
  }
}

export async function getVideoDetails(videoId) {
  const data = await ytFetch('/videos', {
    part: 'snippet,contentDetails',
    id: videoId,
  });

  const video = data?.items?.[0];
  if (!video) return null;

  return {
    ...normalizeMix({ id: videoId, snippet: video.snippet }, video),
    description: video.snippet?.description ?? '',
  };
}

export async function getVideoComments(videoId, maxResults = 100) {
  const data = await ytFetch('/commentThreads', {
    part: 'snippet',
    videoId,
    maxResults: Math.min(maxResults, 100),
    order: 'relevance',
    textFormat: 'plainText',
  });

  return (data?.items ?? []).map((thread) => ({
    text: thread.snippet?.topLevelComment?.snippet?.textDisplay ?? '',
    likeCount: thread.snippet?.topLevelComment?.snippet?.likeCount ?? 0,
  }));
}

export async function digYouTubeMix(videoId) {
  if (!getApiKey()) return notConfigured();

  try {
    const video = await getVideoDetails(videoId);
    if (!video) {
      return {
        status: 'not_found',
        videoId,
        tracklistSource: null,
        tracks: [],
        message: 'Video not found on YouTube.',
      };
    }

    let comments = [];
    try {
      comments = await getVideoComments(videoId);
    } catch {
      comments = [];
    }

    const { source, tracks: parsedTracks } = extractTracklist(video.description, comments);

    if (!source || parsedTracks.length === 0) {
      return {
        status: 'no_tracklist',
        videoId,
        video,
        tracklistSource: null,
        tracks: [],
        message: 'No tracklist found in the video description or top comments.',
      };
    }

    const limited = parsedTracks.slice(0, MAX_TRACKS_PER_MIX);
    const matched = await matchTracksOnSoundCloud(limited);

    return {
      status: 'success',
      videoId,
      video,
      tracklistSource: source,
      tracks: matched,
      message: null,
    };
  } catch (err) {
    return {
      status: 'error',
      videoId,
      tracklistSource: null,
      tracks: [],
      message: err.message || 'Failed to dig this mix.',
    };
  }
}
