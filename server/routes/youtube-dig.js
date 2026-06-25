import { Router } from 'express';
import { digYouTubeMix } from '../services/youtube.js';
import { validateYouTubeVideoId } from '../utils/validate.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const videoId = validateYouTubeVideoId(req.query.videoId?.trim());
    const result = await digYouTubeMix(videoId);
    res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
});

export default router;
