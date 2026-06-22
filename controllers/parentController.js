import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/db.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper Function: Logs AI Usage to the Database
const logAIUsage = async (userInfo = {}, featureUsed) => {
    const { name = 'Unknown Parent', email = 'unknown@parent.com', role = 'Parent' } = userInfo;
    try {
        await pool.query(
            `INSERT INTO ai_usage_logs (user_name, user_email, user_type, feature_used) 
             VALUES ($1, $2, $3, $4)`,
            [name, email, role, featureUsed]
        );
        console.log(`[LOG] Recorded ${featureUsed} usage by ${name}`);
    } catch (err) {
        console.error("Failed to log AI usage to database:", err);
    }
};

// ==========================================
// 1. ASSIGNMENT TRACKER REPORT
// ==========================================
export const getAssignmentReport = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "Parent Assignment Report");

        const assignments = [
            { subject: "Math", task: "Algebra Worksheet 3", status: "Completed", grade: "A" },
            { subject: "Science", task: "Chapter 1 Summary", status: "Pending", due: "Tomorrow" },
            { subject: "History", task: "Essay Draft", status: "Missing", due: "Last Friday" }
        ];

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are an AI school assistant giving a quick update to a parent. 
            Assignment data: ${JSON.stringify(assignments)}.
            
            Provide EXACTLY two short bullet points:
            1. Praise for what the student has completed.
            2. A polite, direct heads-up about what is missing or due soon.
            Keep it incredibly brief.
        `;

        const aiResult = await model.generateContent(prompt);
        res.json({ report: aiResult.response.text(), list: assignments });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate assignment report", details: err.message });
    }
};

// ==========================================
// 2 & 3. PERFORMANCE ANALYTICS (Subject & Overall Progress)
// ==========================================
export const getParentAnalytics = async (req, res) => {
    const { scope, subject, userInfo } = req.body; 

    try {
        await logAIUsage(userInfo, "Parent Progress Analytics");

        let mockData = [];
        let promptContext = "";

        if (scope === 'single') {
            mockData = [
                { test_name: "Unit 1", score: 75 }, 
                { test_name: "Midterm", score: 82 }, 
                { test_name: "Unit 2", score: 88 }
            ];
            promptContext = `Analyze the student's progress in ${subject}.`;
        } else {
            mockData = [
                { subject: "Math", score: 88 }, 
                { subject: "Science", score: 92 }, 
                { subject: "English", score: 78 },
                { subject: "History", score: 85 }
            ];
            promptContext = `Analyze the student's overall academic progress across all subjects.`;
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are an AI Progress Tracker assistant talking to a parent. ${promptContext} 
            Data: ${JSON.stringify(mockData)}.
            
            Provide EXACTLY two short bullet points:
            1. A summary of their current academic trend.
            2. One specific, actionable tip the parent can do at home to support their child.
            Keep it highly scannable and encouraging.
        `;

        const aiResult = await model.generateContent(prompt);
        res.json({ analysis: aiResult.response.text(), chartData: mockData });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate parent analytics", details: err.message });
    }
};

// ==========================================
// 4 & 5. TRANSLATOR
// ==========================================
export const translateForParent = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and language required" });

    try {
        await logAIUsage(userInfo, "Parent Translator");

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        // FIXED: Strict Translation Prompt!
        const prompt = `CRITICAL INSTRUCTION: You MUST generate your ENTIRE response in the ${targetLanguage} language. Do not use English unless requested.
        Translate this school communication into ${targetLanguage}: "${text}". Return ONLY the translation, nothing else.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.response.text().trim() });
    } catch (err) {
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};