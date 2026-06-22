import express from 'express';
import { 
    getAssignmentReport, 
    getAcademicAnalytics, 
    getTeacherPerformance, 
    translateForHeadmaster 
} from '../controllers/headmasterController.js';

const router = express.Router();

router.get('/assignment-report', getAssignmentReport); // Task 1
router.post('/academic-analytics', getAcademicAnalytics); // Tasks 2, 3, 4, 5
router.get('/teacher-performance', getTeacherPerformance); // Task 6
router.post('/translate', translateForHeadmaster); // Task 8

export default router;