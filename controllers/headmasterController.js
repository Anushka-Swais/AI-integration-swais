import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/db.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. ASSIGNMENT TRACKER REPORT (School-wide)
export const getAssignmentReport = async (req, res) => {
    try {
        const mockData = { totalAssigned: 1200, completed: 950, missing: 250, criticalClasses: ["Grade 10-A", "Grade 8-B"] };
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Act as an executive AI for a Headmaster. Summarize this school-wide assignment data: ${JSON.stringify(mockData)}. Write a 3-bullet executive summary highlighting completion rates and identifying which classes need administrative intervention.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ report: aiResult.response.text() });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate assignment report", details: err.message });
    }
};

// 2, 3, 4, 5. UNIFIED ACADEMIC ANALYTICS ENGINE
export const getAcademicAnalytics = async (req, res) => {
    const { targetName, targetType, scope } = req.body; 
    // targetType: 'student' or 'class'
    // scope: 'single_subject' or 'all_subjects'

    try {
        let mockData = [];
        let promptContext = "";

        // Dynamically build the data and prompt based on what the Headmaster clicked
        if (targetType === 'student' && scope === 'single_subject') {
            mockData = [{ test: "Term 1", score: 85 }, { test: "Term 2", score: 88 }];
            promptContext = `Analyze the performance of student ${targetName} in a specific subject.`;
        } else if (targetType === 'student' && scope === 'all_subjects') {
            mockData = [{ subject: "Math", score: 85 }, { subject: "Science", score: 92 }, { subject: "English", score: 78 }];
            promptContext = `Analyze the overall performance of student ${targetName} across ALL subjects.`;
        } else if (targetType === 'class' && scope === 'single_subject') {
            mockData = [{ student: "Aarav", score: 85 }, { student: "Priya", score: 45 }, { student: "Rohan", score: 78 }];
            promptContext = `Analyze the performance of class ${targetName} in a specific subject. Identify struggling students.`;
        } else if (targetType === 'class' && scope === 'all_subjects') {
            mockData = [{ term: "Term 1", avg: 75 }, { term: "Term 2", avg: 78 }];
            promptContext = `Analyze the overall cohort performance of class ${targetName} across ALL subjects over time.`;
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Act as an AI Principal. ${promptContext} Data: ${JSON.stringify(mockData)}. Write a concise, 1-paragraph executive summary of their trajectory.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ analysis: aiResult.response.text(), chartData: mockData });
    } catch (err) {
        res.status(500).json({ error: "Failed to run academic analytics", details: err.message });
    }
};

// 6. TEACHER PERFORMANCE (Assignments & Parent Interactions)
export const getTeacherPerformance = async (req, res) => {
    try {
        const teacherData = [
            { name: "Mr. Sharma", assignmentCompletionRate: "95%", parentMeetingsAttended: 12, parentFeedback: "Positive" },
            { name: "Ms. Gupta", assignmentCompletionRate: "70%", parentMeetingsAttended: 3, parentFeedback: "Needs Improvement" }
        ];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Act as an AI HR Director. Analyze this teacher KPI data focusing on assignment completion and parent interactions: ${JSON.stringify(teacherData)}. Write a bulleted review. Highlight top performers and suggest coaching for others.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ report: aiResult.response.text() });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate teacher report", details: err.message });
    }
};

// 8. LANGUAGE TRANSLATOR (Feature 7 Listen is in the frontend)
export const translateForHeadmaster = async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Missing parameters" });
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Translate this official school communication into ${targetLanguage}: "${text}". Return ONLY the translation.`;
        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.response.text().trim() });
    } catch (err) {
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};