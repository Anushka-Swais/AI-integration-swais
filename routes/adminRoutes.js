import express from 'express';
import { translateAdminText, formatVoiceTranscription } from '../controllers/adminController.js';

const router = express.Router();

// Admin Dashboard AI Routes
router.post('/translate', translateAdminText);
router.post('/format-voice', formatVoiceTranscription);

export default router;