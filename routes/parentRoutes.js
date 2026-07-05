import express from 'express';
import { 
    getAssignmentReport, 
    getParentAnalytics, 
    translateForParent,
    handleTextToSpeech // ADDED THIS IMPORT
} from '../controllers/parentController.js';

const router = express.Router();

// 👨‍👩‍👦 Parent Dashboard Routes
// ALL changed to POST to support DB Usage Logging
router.post('/assignments', getAssignmentReport);
router.post('/analytics', getParentAnalytics);
router.post('/translate', translateForParent);

// 🔊 Google Cloud Text-to-Speech Endpoint (ADDED THIS ROUTE)
router.post('/speak', handleTextToSpeech);

export default router;