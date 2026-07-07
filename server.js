import dotenv from 'dotenv';
// ⚡ CRITICAL: Dotenv MUST be loaded before any imports that use process.env
dotenv.config();

import express from 'express';
import cors from 'cors';
import pool from './config/db.js'; // Import your DB pool

// 📦 IMPORT EXISTING DASHBOARD ROUTES
import studentRoutes from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js'; 

// ✅ UNCOMMENTED PARENT ROUTES
import parentRoutes from './routes/parentRoutes.js';        
import headmasterRoutes from './routes/headmasterRoutes.js'; 
import adminRoutes from './routes/adminRoutes.js';

// 🔊 IMPORT CONTROLLERS FOR THE MISSING ROUTES
import { handleTextToSpeech, translateText } from './controllers/teacherController.js'; // ADDED translateText HERE

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

// ✅ UNCOMMENTED PARENT DASHBOARD
app.use('/api/v1/ai/parent', parentRoutes);         
app.use('/api/v1/ai/headmaster', headmasterRoutes); 
app.use('/api/v1/ai/admin', adminRoutes);

// 🔊 ADD THE MISSING FRONTEND ROUTES HERE
app.post('/api/v1/speech/to-voice', handleTextToSpeech);
app.post('/api/v1/translate/text', translateText); // 🌐 ADDED THIS TRANSLATE ROUTE

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