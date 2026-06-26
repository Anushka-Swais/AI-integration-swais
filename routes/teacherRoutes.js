import express from 'express';
import { 
    generateLessonPlan, 
    generateQuestionPaper,
    autoCorrectAnswer,
    generateAssignmentReminders,
    getAssignmentCompletionAlerts, // NEW: For assignment completion tracking
    getSingleStudentAnalytics,   
    getClassAnalytics, 
    translateText,
    teacherChatbot,
    processVirtualSlateContent     // NEW: For the Virtual Slate AI processing
} from '../controllers/teacherController.js';

const router = express.Router();

// 1. Auto Content Generation
router.post('/lesson-plan', generateLessonPlan);
router.post('/question-paper', generateQuestionPaper);
router.post('/correct-answer', autoCorrectAnswer);

// 2. Alerts & Reminders
router.post('/assignment-reminders', generateAssignmentReminders); 
router.post('/completion-alerts', getAssignmentCompletionAlerts); // NEW ROUTE

// 3. Analytics (Now supports subject filtering in the controller)
router.post('/student-analytics', getSingleStudentAnalytics);    
router.post('/class-analytics', getClassAnalytics);

// 4. Utilities & Tools
router.post('/translate', translateText);
router.post('/chat', teacherChatbot); 
router.post('/virtual-slate', processVirtualSlateContent); // NEW ROUTE

export default router;