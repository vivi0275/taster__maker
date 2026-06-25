import { digYouTubeMix } from '../../server/services/youtube.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const videoId = req.query.videoId?.trim();

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required.' });
  }

  const result = await digYouTubeMix(videoId);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(result);
}
