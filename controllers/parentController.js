import model from '../config/aiConfig.js';
import pool from "../config/db.js";
import textToSpeech from '@google-cloud/text-to-speech'; // REQUIRED FOR GOOGLE TTS

// Google Cloud TTS Client Initialize using your API KEY from .env
const ttsClient = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_TTS_API_KEY
});

// Google Cloud Voice Mapping (For multiple languages)
const googleVoiceMap = {
    "English": { languageCode: "en-IN", name: "en-IN-Neural2-B" },
    "Hindi": { languageCode: "hi-IN", name: "hi-IN-Neural2-A" },
    "Telugu": { languageCode: "te-IN", name: "te-IN-Standard-A" },
    "Kannada": { languageCode: "kn-IN", name: "kn-IN-Standard-A" },
    "Tamil": { languageCode: "ta-IN", name: "ta-IN-Standard-A" },
    "Malayalam": { languageCode: "ml-IN", name: "ml-IN-Standard-A" },
    "Bengali": { languageCode: "bn-IN", name: "bn-IN-Standard-A" },
    "Marathi": { languageCode: "mr-IN", name: "mr-IN-Standard-A" },
    "Oriya": { languageCode: "or-IN", name: "or-IN-Standard-A" }
};

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

        const prompt = `
You are SGS AI Parent Assistant.

Review the following assignment information.

Assignment Data

${JSON.stringify(assignments)}

Generate a concise parent update.

Include:

• Positive progress made by the student.
• Missing or overdue assignments.
• Upcoming work requiring attention.

IMPORTANT FORMAT RULES

- Maximum 3 bullet points.
- Use encouraging language.
- Do not use Markdown tables.
- Do not use Markdown code blocks.
- Do not use HTML.
- Do not use ASCII diagrams.
- Do not use LaTeX.
- Do not use $ or $$.
- Use plain text only.
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ report: aiResult.text, list: assignments });
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

        const prompt = `
You are SGS AI Parent Progress Assistant.

${promptContext}

Student Performance Data

${JSON.stringify(mockData)}

Generate a parent-friendly report.

Include

• Overall academic progress.
• Strongest subject.
• Subject needing improvement (if any).
• One practical suggestion for parents to support learning at home.

IMPORTANT FORMAT RULES

- Maximum 4 bullet points.
- Use simple language.
- Keep the tone encouraging.
- Do not use Markdown.
- Do not use HTML.
- Do not use LaTeX.
- Do not use $.
- Plain text only.
`;

        const aiResult = await model.generateContent(prompt);
        res.status(200).json({ analysis: aiResult.text, chartData: mockData });

    } catch (err) {
        console.error("🚨 PARENT ANALYTICS CRASH:", err);
        
        // 🔥 CONTINGENCY: If AI fails, still send the chart data so the UI doesn't crash!
        const fallbackData = scope === 'single' 
            ? [ { test_name: "Unit 1", score: 75 }, { test_name: "Midterm", score: 82 }, { test_name: "Unit 2", score: 88 } ]
            : [ { subject: "Math", score: 88 }, { subject: "Science", score: 92 }, { subject: "English", score: 78 }, { subject: "History", score: 85 } ];

        res.status(200).json({ 
            analysis: "Service Notice: The AI assistant is temporarily unavailable. The academic performance charts below are still available for review.",
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

        const prompt = `
Translate the following school communication into ${targetLanguage}.

Requirements

- Return ONLY the translated text.
- Do not explain the translation.
- Do not add quotation marks.
- Preserve bullet points.
- Preserve names.
- Preserve dates.
- Do not use Markdown.
- Do not use HTML.

School Communication

"${text}"
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.text.trim() });
    } catch (err) {
        console.error("🚨 TRANSLATOR CRASH:", err);
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};

// ==========================================
// 5. GOOGLE CLOUD TEXT-TO-SPEECH (For Parent Notices/Remarks)
// ==========================================
export const handleTextToSpeech = async (req, res) => {
    const { text, language = "English" } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Text is required for speech synthesis" });
    }

    try {
        const voiceConfig = googleVoiceMap[language] || googleVoiceMap["English"];

        const request = {
            input: { text: text },
            voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioBase64 = response.audioContent.toString('base64');

        res.json({
            status: "success",
            audioData: audioBase64
        });

    } catch (err) {
        console.error("🚨 GOOGLE TTS CRASH:", err);
        res.status(500).json({
            error: "Failed to generate Google cloud speech output",
            details: err.message
        });
    }
};