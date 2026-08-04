import express from 'express';
import { 
    handleStudentChat, 
    generateAutoQuiz, 
    getStudentAnalytics,
    generatePacedContent,
    handleTextToSpeech // ADDED THIS IMPORT
} from '../controllers/studentController.js';

import { generateCompetitiveContent } from '../controllers/competitiveController.js';
import { postDoubt, getCommunityDoubts, answerDoubt } from '../controllers/communityController.js';


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

// Competitive Exam Route (Used by both Student and Teacher dashboards)
router.post('/competitive/generate', generateCompetitiveContent);

// Community Doubt Forum Routes
router.post('/community/doubt', postDoubt);          // Ask a doubt
router.get('/community/doubts', getCommunityDoubts); // View all doubts feed
router.post('/community/answer', answerDoubt);       // Answer a doubt

export default router;