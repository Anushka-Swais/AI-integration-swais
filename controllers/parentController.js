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
// 1. ASSIGNMENT TRACKER REPORT (Live Database Query)
// ==========================================
export const getAssignmentReport = async (req, res) => {
    const { userInfo } = req.body;
    const parentId = userInfo?.id || 1;

    try {
        await logAIUsage(userInfo, "Parent Assignment Report");

        // 🔥 Live Database Query using Parent-Student Mapping
        const dbResult = await pool.query(`
            SELECT a.assessment_type AS subject, a.title AS task, a.assessment_date AS due,
                   CASE WHEN ar.is_absent = true OR ar.marks_obtained IS NULL THEN 'Missing' ELSE 'Completed' END AS status,
                   ar.percentage AS grade
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            JOIN sgs_parent_student_map psm ON ar.student_id = psm.student_id
            WHERE psm.parent_id = $1
            ORDER BY a.assessment_date DESC
            LIMIT 5;
        `, [parentId]);

        let assignments = dbResult.rows;

        // Fallback if DB is empty
        if (assignments.length === 0) {
            assignments = [
                { subject: "Math", task: "Algebra Worksheet 3", status: "Completed", grade: "85" },
                { subject: "Science", task: "Chapter 1 Summary", status: "Pending", due: "Tomorrow" },
                { subject: "History", task: "Essay Draft", status: "Missing", due: "Last Friday" }
            ];
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are an AI school assistant giving a quick update to a parent. 
            Assignment data: ${JSON.stringify(assignments)}.
            
            Provide EXACTLY two short bullet points:
            1. Praise for what the student has completed.
            2. A polite, direct heads-up about what is missing or due soon.
            Keep it incredibly brief. Do not use Markdown code blocks.
        `;

        const aiResult = await model.generateContent(prompt);
        res.json({ report: aiResult.response.text(), list: assignments });
    } catch (err) {
        console.error("🚨 ASSIGNMENT REPORT CRASH:", err);
        res.status(500).json({ error: "Failed to generate assignment report", details: err.message });
    }
};

// ==========================================
// 2 & 3. PERFORMANCE ANALYTICS (Live Database Query)
// ==========================================
export const getParentAnalytics = async (req, res) => {
    const { scope, subject, userInfo } = req.body; 
    const parentId = userInfo?.id || 1;

    try {
        await logAIUsage(userInfo, "Parent Progress Analytics");

        let dbResult;
        let mockData = [];

        // 🔥 Live Database Queries based on scope
        if (scope === 'single') {
            dbResult = await pool.query(`
                SELECT a.title AS test_name, ar.percentage AS score
                FROM sgs_assessment_results ar
                JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
                JOIN sgs_parent_student_map psm ON ar.student_id = psm.student_id
                WHERE psm.parent_id = $1 AND a.title ILIKE $2 AND ar.percentage IS NOT NULL
                ORDER BY a.assessment_date ASC
                LIMIT 5;
            `, [parentId, `%${subject}%`]);
            mockData = dbResult.rows;
        } else {
            dbResult = await pool.query(`
                SELECT a.assessment_type AS subject, ROUND(AVG(ar.percentage), 2) AS score
                FROM sgs_assessment_results ar
                JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
                JOIN sgs_parent_student_map psm ON ar.student_id = psm.student_id
                WHERE psm.parent_id = $1 AND ar.percentage IS NOT NULL
                GROUP BY a.assessment_type;
            `, [parentId]);
            mockData = dbResult.rows;
        }

        // Fallback for empty DB
        if (mockData.length === 0) {
            mockData = scope === 'single' 
                ? [ { test_name: "Unit 1", score: 75 }, { test_name: "Midterm", score: 82 }, { test_name: "Unit 2", score: 88 } ]
                : [ { subject: "Math", score: 88 }, { subject: "Science", score: 92 }, { subject: "English", score: 78 }, { subject: "History", score: 85 } ];
        }
        
        let promptContext = scope === 'single' 
            ? `Analyze the student's progress in ${subject}.`
            : `Analyze the student's overall academic progress across all subjects.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are an AI Progress Tracker assistant talking to a parent. ${promptContext} 
            Data: ${JSON.stringify(mockData)}.
            
            Provide EXACTLY two short bullet points:
            1. A summary of their current academic trend.
            2. One specific, actionable tip the parent can do at home to support their child.
            Keep it highly scannable and encouraging. Do not use Markdown code blocks.
        `;

        const aiResult = await model.generateContent(prompt);
        res.status(200).json({ analysis: aiResult.response.text(), chartData: mockData });

    } catch (err) {
        console.error("🚨 PARENT ANALYTICS CRASH:", err);
        
        // 🔥 CONTINGENCY: If AI fails, still send the chart data so the UI doesn't crash!
        const fallbackData = scope === 'single' 
            ? [ { test_name: "Unit 1", score: 75 }, { test_name: "Midterm", score: 82 }, { test_name: "Unit 2", score: 88 } ]
            : [ { subject: "Math", score: 88 }, { subject: "Science", score: 92 }, { subject: "English", score: 78 }, { subject: "History", score: 85 } ];

        res.status(200).json({ 
            analysis: "🚨 **Service Notice:** The AI is currently busy, but you can still review the chart data below.", 
            chartData: fallbackData 
        });
    }
};

// ==========================================
// 4. TRANSLATOR
// ==========================================
export const translateForParent = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and language required" });

    try {
        await logAIUsage(userInfo, "Parent Translator");

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `CRITICAL INSTRUCTION: You MUST generate your ENTIRE response in the ${targetLanguage} language. Do not use English unless requested.
        Translate this school communication into ${targetLanguage}: "${text}". Return ONLY the translation, nothing else.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.response.text().trim() });
    } catch (err) {
        console.error("🚨 TRANSLATOR CRASH:", err);
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};