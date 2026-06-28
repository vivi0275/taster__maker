import { extractTracklist } from './tracklist-parser.js';
import { matchTracksOnSoundCloud } from './soundcloud.js';
import { getYouTubeApiKey } from '../utils/env.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_MIXES = 12;
const MAX_TRACKS_PER_MIX = 25;
const MIXES_CACHE_TTL_MS = 30 * 60 * 1000;

const PREMIUM_CHANNELS = [
  'boiler room',
  'cercle',
  'tomorrowland',
  'dj mag',
  'bbc radio 1',
  'fabriclondon',
  'dekmantel',
  'time warp',
  'awakenings',
  'mixmag',
  'defected',
  'toolroom',
  'keinemusik',
  'hï ibiza',
  'dc10',
  'printworks',
  'residency',
  'nts live',
  'rinse fm',
  'hor berlin',
];

const MIX_KEYWORDS = [
  'live set',
  'live @',
  'live at',
  'b2b',
  'essential mix',
  'podcast',
  'dj set',
  'live from',
  'live for',
  'on the decks',
  'in the mix',
];

const BAD_KEYWORDS = [
  'reaction',
  'tutorial',
  'how to',
  'review',
  'interview',
  'documentary',
  '#shorts',
  'shorts',
  'teaser',
  'trailer',
  'announcement',
  'unboxing',
];

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

function countTimestampHints(text) {
  if (!text) return 0;
  return (text.match(/\d{1,2}:\d{2}(?::\d{2})?/g) ?? []).length;
}

function hasTracklistHint(description) {
  if (!description?.trim()) return false;
  const lower = description.toLowerCase();
  if (/track\s*list|set\s*list|tracklist|setlist/i.test(lower)) return true;
  return countTimestampHints(description) >= 5;
}

function buildSearchQueries(artistName) {
  const year = new Date().getFullYear();
  const quoted = `"${artistName}"`;

  return [
    { q: `${quoted} live set DJ mix`, order: 'viewCount', maxResults: 10 },
    { q: `${quoted} boiler room`, order: 'relevance', maxResults: 8 },
    {
      q: `${quoted} live set ${year}`,
      order: 'date',
      maxResults: 10,
      publishedAfter: `${year - 1}-01-01T00:00:00Z`,
    },
    { q: `${quoted} essential mix`, order: 'viewCount', maxResults: 6 },
    { q: `${artistName} live set mix`, order: 'relevance', maxResults: 8, videoDuration: 'long' },
  ];
}

async function searchVideos(params) {
  const data = await ytFetch('/search', {
    part: 'snippet',
    type: 'video',
    videoDuration: 'long',
    ...params,
  });
  return data?.items ?? [];
}

async function fetchVideoDetailsBatch(videoIds) {
  if (videoIds.length === 0) return new Map();

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const detailsById = new Map();
  for (const chunk of chunks) {
    const data = await ytFetch('/videos', {
      part: 'snippet,contentDetails,statistics',
      id: chunk.join(','),
    });
    for (const video of data?.items ?? []) {
      detailsById.set(video.id, video);
    }
  }

  return detailsById;
}

function normalizeMix(item, details = null) {
  const id = item.id?.videoId ?? item.id;
  const snippet = details?.snippet ?? item.snippet;
  const content = details?.contentDetails;
  const stats = details?.statistics ?? {};
  const description = snippet?.description ?? '';

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
    viewCount: Number(stats.viewCount ?? 0),
    likeCount: Number(stats.likeCount ?? 0),
    hasTracklistHint: hasTracklistHint(description),
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

function isRelevantMix(mix, artistName) {
  const artist = artistName.toLowerCase();
  const title = mix.title.toLowerCase();
  const channel = mix.channelTitle.toLowerCase();

  if (BAD_KEYWORDS.some((k) => title.includes(k))) return false;
  if (mix.durationSeconds == null) return false;

  if (namesMatch(title, artistName) || namesMatch(channel, artistName)) return true;

  const hasKeyword = MIX_KEYWORDS.some((k) => title.includes(k));
  const mentionsArtist = title.includes(artist) || channel.includes(artist);
  const premiumChannel = PREMIUM_CHANNELS.some((c) => channel.includes(c));

  return (hasKeyword && mentionsArtist) || (premiumChannel && mentionsArtist);
}

function scoreMix(mix, artistName) {
  const title = mix.title.toLowerCase();
  const channel = mix.channelTitle.toLowerCase();
  const views = mix.viewCount ?? 0;
  const ageDays = mix.publishedAt
    ? (Date.now() - new Date(mix.publishedAt).getTime()) / 86400000
    : 3650;

  const viewScore = Math.min(Math.log10(views + 1) / 7, 1);
  const recencyScore = Math.exp(-ageDays / 540);
  const likeRatio = views > 0 ? Math.min((mix.likeCount ?? 0) / views, 0.05) / 0.05 : 0;

  let relevanceScore = 0;
  if (namesMatch(mix.title, artistName)) relevanceScore += 0.25;
  if (namesMatch(mix.channelTitle, artistName)) relevanceScore += 0.2;
  if (PREMIUM_CHANNELS.some((c) => channel.includes(c))) relevanceScore += 0.2;
  if (MIX_KEYWORDS.some((k) => title.includes(k))) relevanceScore += 0.12;
  if (mix.hasTracklistHint) relevanceScore += 0.18;

  return (
    viewScore * 0.38 +
    recencyScore * 0.28 +
    likeRatio * 0.07 +
    Math.min(relevanceScore, 0.45) * 0.27
  );
}

export async function searchYouTubeMixes(artistName) {
  if (!getApiKey()) return notConfigured();

  const cached = getCachedMixes(artistName);
  if (cached) return cached;

  try {
    const queries = buildSearchQueries(artistName);
    const searchResults = await Promise.allSettled(
      queries.map((query) => searchVideos(query))
    );

    const seenIds = new Set();
    const searchItems = [];

    for (const result of searchResults) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        const id = item.id?.videoId;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        searchItems.push(item);
      }
    }

    if (searchItems.length === 0) {
      const empty = {
        status: 'success',
        mixes: [],
        message: `No YouTube mixes found for "${artistName}".`,
      };
      setCachedMixes(artistName, empty);
      return empty;
    }

    const videoIds = searchItems.map((i) => i.id?.videoId).filter(Boolean);
    const detailsById = await fetchVideoDetailsBatch(videoIds);

    const mixes = searchItems
      .map((item) => {
        const id = item.id?.videoId;
        return normalizeMix(item, detailsById.get(id));
      })
      .filter((mix) => isRelevantMix(mix, artistName))
      .map((mix) => ({ ...mix, score: scoreMix(mix, artistName) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MIXES)
      .map(({ score, ...mix }, index) => ({
        ...mix,
        rank: index + 1,
      }));

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
    return {
      status: 'error',
      mixes: [],
      message: err.message || 'Failed to fetch YouTube mixes.',
    };
  }
}

export async function getVideoDetails(videoId) {
  const data = await ytFetch('/videos', {
    part: 'snippet,contentDetails,statistics',
    id: videoId,
  });

  const video = data?.items?.[0];
  if (!video) return null;

  return {
    ...normalizeMix({ id: videoId, snippet: video.snippet }, video),
    description: video.snippet?.description ?? '',
  };
}

async function fetchCommentThreads(videoId, order, maxResults) {
  const data = await ytFetch('/commentThreads', {
    part: 'snippet',
    videoId,
    maxResults: Math.min(maxResults, 100),
    order,
    textFormat: 'plainText',
  });

  return (data?.items ?? []).map((thread) => ({
    text: thread.snippet?.topLevelComment?.snippet?.textDisplay ?? '',
    likeCount: thread.snippet?.topLevelComment?.snippet?.likeCount ?? 0,
  }));
}

export async function getVideoComments(videoId, maxResults = 100) {
  const perOrder = Math.min(Math.ceil(maxResults / 2), 50);
  const [relevanceResult, timeResult] = await Promise.allSettled([
    fetchCommentThreads(videoId, 'relevance', perOrder),
    fetchCommentThreads(videoId, 'time', perOrder),
  ]);

  const merged = [];
  const seen = new Set();

  for (const result of [relevanceResult, timeResult]) {
    if (result.status !== 'fulfilled') continue;
    for (const comment of result.value) {
      const key = comment.text.slice(0, 120);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(comment);
    }
  }

  return merged.slice(0, maxResults);
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
