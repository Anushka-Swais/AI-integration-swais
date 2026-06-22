import express from 'express';
import { 
    generateLessonPlan, 
    generateQuestionPaper,
    autoCorrectAnswer,
    generateAssignmentReminders, 
    getSingleStudentAnalytics,   
    getClassAnalytics, 
    translateText,
    teacherChatbot 
} from '../controllers/teacherController.js';

const router = express.Router();

router.post('/lesson-plan', generateLessonPlan);
router.post('/question-paper', generateQuestionPaper);
router.post('/correct-answer', autoCorrectAnswer);
router.post('/assignment-reminders', generateAssignmentReminders); 
router.post('/student-analytics', getSingleStudentAnalytics);    
router.post('/class-analytics', getClassAnalytics);
router.post('/translate', translateText);
router.post('/chat', teacherChatbot); 

export default router;