import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import searchRouter from './routes/search.js';
import beyondRouter from './routes/beyond.js';
import soundcloudPreviewRouter from './routes/soundcloud-preview.js';
import soundcloudArtworkRouter from './routes/soundcloud-artwork.js';
import soundcloudTokenRouter from './routes/soundcloud-token.js';
import youtubeDigRouter from './routes/youtube-dig.js';
import youtubeMixesRouter from './routes/youtube-mixes.js';
import { getYouTubeApiKey, getLastfmApiKey } from './utils/env.js';
import { isSharedTokenStoreConfigured } from './utils/soundcloud-token-store.js';
import { rateLimit } from './utils/rate-limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = new Set(
  [
    'http://localhost:5173',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3001',
    'https://tastermaker.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.CLIENT_ORIGIN,
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    soundcloud: Boolean(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET),
    spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    lastfm: Boolean(getLastfmApiKey()),
    youtube: Boolean(getYouTubeApiKey()),
    tokenStore: isSharedTokenStoreConfigured() ? 'upstash' : 'memory',
  });
});

app.use('/api/search', rateLimit({ name: 'search', max: 30, windowSec: 60 }), searchRouter);
app.use('/api/beyond', rateLimit({ name: 'beyond', max: 20, windowSec: 60 }), beyondRouter);
app.use(
  '/api/soundcloud/preview',
  rateLimit({ name: 'sc-preview', max: 40, windowSec: 60 }),
  soundcloudPreviewRouter
);
app.use(
  '/api/soundcloud/artwork',
  rateLimit({ name: 'sc-artwork', max: 60, windowSec: 60 }),
  soundcloudArtworkRouter
);
app.use('/api/soundcloud/token', rateLimit({ name: 'sc-token', max: 10, windowSec: 60 }), soundcloudTokenRouter);
app.use('/api/youtube/dig', rateLimit({ name: 'yt-dig', max: 15, windowSec: 60 }), youtubeDigRouter);
app.use('/api/youtube/mixes', rateLimit({ name: 'yt-mixes', max: 30, windowSec: 60 }), youtubeMixesRouter);

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Tastemaker server running on http://localhost:${PORT}`);
});
