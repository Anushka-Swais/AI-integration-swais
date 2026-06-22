import express from 'express';
import { 
    getAssignmentReport, 
    getParentAnalytics, 
    translateForParent 
} from '../controllers/parentController.js';

const router = express.Router();

// 👨‍👩‍👦 Parent Dashboard Routes
// ALL changed to POST to support DB Usage Logging
router.post('/assignments', getAssignmentReport);
router.post('/analytics', getParentAnalytics);
router.post('/translate', translateForParent);

export default router;