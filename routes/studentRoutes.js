import express from 'express';
import { 
    handleStudentChat, 
    generateAutoQuiz, 
    getStudentAnalytics,
    generatePacedContent,
    handleTextToSpeech // ADDED THIS IMPORT
} from '../controllers/studentController.js';

const router = express.Router();

// 💬 Student Chat Endpoint
router.post('/chat', handleStudentChat);

// 📝 Student Quiz Endpoint
router.post('/generate-quiz', generateAutoQuiz);

// 📊 Student Analytics Endpoint (Changed to POST for DB tracking)
router.post('/analytics', getStudentAnalytics);

// 📖 Auto Content Generation based on Learning Pace
router.post('/generate-content', generatePacedContent); 

// 🔊 Google Cloud Text-to-Speech Endpoint (ADDED THIS ROUTE)
router.post('/speak', handleTextToSpeech);

export default router;