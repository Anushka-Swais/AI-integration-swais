import dotenv from 'dotenv';
// ⚡ CRITICAL: Dotenv MUST be loaded before any imports that use process.env
dotenv.config();

import express from 'express';
import cors from 'cors';
import pool from './config/db.js'; // Import your DB pool

// 📦 IMPORT EXISTING DASHBOARD ROUTES
import studentRoutes from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js'; 
import parentRoutes from './routes/parentRoutes.js';        
import headmasterRoutes from './routes/headmasterRoutes.js'; 
import adminRoutes from './routes/adminRoutes.js';

// 🔊 IMPORT EXISTING CONTROLLERS
import { handleTextToSpeech, translateText } from './controllers/teacherController.js'; 

// 🚀 NEW: IMPORT COMPETITIVE & COMMUNITY CONTROLLERS
import { generateCompetitiveContent } from './controllers/competitiveController.js';
import { postDoubt, getCommunityDoubts, answerDoubt } from './controllers/communityController.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Modular SGS Engine Online', database: 'Ready' });
});

// 🚀 MOUNT EXISTING DASHBOARDS
app.use('/api/v1/ai/tutoring', studentRoutes);
app.use('/api/v1/ai/teacher', teacherRoutes);
app.use('/api/v1/ai/parent', parentRoutes);         
app.use('/api/v1/ai/headmaster', headmasterRoutes); 
app.use('/api/v1/ai/admin', adminRoutes);

// 🌟 NEW: MOUNT COMPETITIVE EXAM & COMMUNITY FORUM ROUTES
// We mount these directly so both Student and Teacher dashboards can hit them!
app.post('/api/v1/competitive/generate', generateCompetitiveContent);
app.post('/api/v1/community/doubt', postDoubt);
app.get('/api/v1/community/doubts', getCommunityDoubts);
app.post('/api/v1/community/answer', answerDoubt);

// 🔍 DATABASE CONNECTION TEST
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("❌ Database Connection Failed:", err.message);
  } else {
    console.log("✅ Database Connected Successfully!");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Modular AI Server running cleanly on port ${PORT}`);
});