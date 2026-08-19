import express from 'express';
import { 
    generateLessonPlan, 
    generateQuestionPaper,
    autoCorrectAnswer,
    generateAssignmentReminders,
    getAssignmentCompletionAlerts, 
    getSingleStudentAnalytics,   
    getClassAnalytics, 
    translateText,
    teacherChatbot,
    processVirtualSlateContent,
    handleTextToSpeech // 🔊 ADDED THIS IMPORT
} from '../controllers/teacherController.js';

import { generateCompetitiveContent } from '../controllers/competitiveController.js';
import { postDoubt, getCommunityDoubts, answerDoubt } from '../controllers/communityController.js';

import { generateWeeklyTest } from '../controllers/yourControllerFile.js';


const router = express.Router();

// 1. Auto Content Generation
router.post('/lesson-plan', generateLessonPlan);
router.post('/question-paper', generateQuestionPaper);
router.post('/correct-answer', autoCorrectAnswer);

// 2. Alerts & Reminders
router.post('/assignment-reminders', generateAssignmentReminders); 
router.post('/completion-alerts', getAssignmentCompletionAlerts); 

// 3. Analytics (Now supports subject filtering in the controller)
router.post('/student-analytics', getSingleStudentAnalytics);    
router.post('/class-analytics', getClassAnalytics);

// 4. Utilities & Tools
router.post('/translate', translateText);
router.post('/chat', teacherChatbot); 
router.post('/virtual-slate', processVirtualSlateContent); 

// 5. Speech Services
router.post('/speak', handleTextToSpeech); // 🔊 ADDED THIS ROUTE

// Competitive Exam Route (Used by both Student and Teacher dashboards)
router.post('/competitive/generate', generateCompetitiveContent);

// Community Doubt Forum Routes
router.post('/community/doubt', postDoubt);          // Ask a doubt
router.get('/community/doubts', getCommunityDoubts); // View all doubts feed
router.post('/community/answer', answerDoubt);       // Answer a doubt

// Weekly test report
router.post('/generate-weekly-test', generateWeeklyTest);

export default router;