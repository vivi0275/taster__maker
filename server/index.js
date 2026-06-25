import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import searchRouter from './routes/search.js';
import beyondRouter from './routes/beyond.js';
import soundcloudPreviewRouter from './routes/soundcloud-preview.js';
import soundcloudArtworkRouter from './routes/soundcloud-artwork.js';
import youtubeDigRouter from './routes/youtube-dig.js';
import youtubeMixesRouter from './routes/youtube-mixes.js';
import { getYouTubeApiKey, getLastfmApiKey } from './utils/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    soundcloud: Boolean(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET),
    spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    lastfm: Boolean(getLastfmApiKey()),
    youtube: Boolean(getYouTubeApiKey()),
  });
});

app.use('/api/search', searchRouter);
app.use('/api/beyond', beyondRouter);
app.use('/api/soundcloud/preview', soundcloudPreviewRouter);
app.use('/api/soundcloud/artwork', soundcloudArtworkRouter);
app.use('/api/youtube/dig', youtubeDigRouter);
app.use('/api/youtube/mixes', youtubeMixesRouter);

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
