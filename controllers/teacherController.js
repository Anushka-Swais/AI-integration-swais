import model from '../config/aiConfig.js';
import pool from "../config/db.js";
import textToSpeech from '@google-cloud/text-to-speech'; // REQUIRED FOR GOOGLE TTS

// Google Cloud TTS Client Initialize using your API KEY from .env
const ttsClient = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_TTS_API_KEY
});

// 🌍 UPDATED: Google Cloud Voice Mapping (Using Language Codes Only)
const googleVoiceMap = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Telugu": "te-IN",
    "Telegu": "te-IN", // Added alternate spelling to be safe
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Oriya": "hi-IN", // Oriya/Odia is often unsupported by TTS, safely falls back to Hindi
    "Sanskrit": "hi-IN" // Sanskrit reads best using the Hindi TTS engine
};

// Helper Function: Logs AI Usage to the Database
const logAIUsage = async (userInfo = {}, featureUsed) => {
    const { name = 'Unknown Teacher', email = 'unknown@sgs.edu', role = 'Teacher' } = userInfo;
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

// 1. AUTO LESSON PLANNER
export const generateLessonPlan = async (req, res) => {
    const { chapterId, durationMinutes = 45, userInfo } = req.body;
    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Lesson Plan");
        
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];

        const prompt = `
You are an expert curriculum developer and senior school teacher.

Create a detailed ${durationMinutes}-minute lesson plan for the chapter:

"${chapter_name}"

Use ONLY the following textbook content:

"${full_text_content}"

The lesson plan must contain:
1. Learning Objectives
2. Prerequisite Knowledge
3. Materials Required
4. Lesson Introduction
5. Step-by-Step Teaching Activities
6. Classroom Interaction Questions
7. Practical Examples
8. Assessment Questions
9. Homework
10. Conclusion

IMPORTANT FORMAT RULES
- Use clear headings.
- Use bullet points where appropriate.
- Never use Markdown tables.
- Never use Markdown code blocks.
- Never use HTML.
- Never use ASCII diagrams.
- Never use LaTeX.
- Never use $ or $$.
- Keep the language professional and teacher-friendly.
`;

        const aiResult = await model.generateContent(prompt);
        const lessonPlanText = aiResult.text;

        await pool.query(
            `INSERT INTO sgs_lesson_plans (teacher_id, title, chapter_id, chapter_text, duration_minutes, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [teacherId, `AI Plan: ${chapter_name}`, chapterId, chapter_name, durationMinutes]
        );

        res.json({ lessonPlan: lessonPlanText });
    } catch (err) {
        console.error("🚨 LESSON PLAN CRASH:", err);
        res.status(500).json({ error: "Failed to generate lesson plan.", details: err.message });
    }
};

// 2. AUTO QUESTION PAPER GENERATOR 
export const generateQuestionPaper = async (req, res) => {
    const { chapterId, difficulty = "Medium", totalMarks = 20, userInfo } = req.body;
    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Exam Paper");

        const result = await pool.query('SELECT full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const content = result.rows[0].full_text_content;
        
        const prompt = `
You are an experienced examination paper setter.

Generate a ${difficulty} level question paper.

The total marks MUST equal exactly ${totalMarks}.

Generate a balanced paper with:
- MCQs
- Short Answer
- Long Answer
- Application Based Questions

Return ONLY valid JSON.
Do NOT return markdown.
Do NOT use backticks.
Do NOT explain the JSON.
Do NOT use LaTeX.
Do NOT use $.

Return exactly this structure:
{
  "paperTitle":"",
  "totalMarks":${totalMarks},
  "questions":[]
}

Chapter Content
"${content}"
`;
        
        const aiResult = await model.generateContent(prompt);
        let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");

        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        console.error("🚨 EXAM CRASH:", err);
        res.status(500).json({ error: "Failed to generate question paper.", details: err.message });
    }
};

// 3. AUTO ANSWER SHEET CORRECTOR 
export const autoCorrectAnswer = async (req, res) => {
    const { question, studentAnswer, maxMarks, rubric, userInfo } = req.body;
    if (!question || !studentAnswer || !maxMarks || !rubric) return res.status(400).json({ error: "Missing required fields" });

    try {
        await logAIUsage(userInfo, "Grade Sample Answer");

        const prompt = `
You are an experienced school examiner.

Question
"${question}"

Maximum Marks
${maxMarks}

Teacher Rubric
"${rubric}"

Student Answer
"${studentAnswer}"

Evaluate fairly.
Award partial marks where appropriate.

Return ONLY valid JSON.
Do NOT return markdown.
Do NOT use backticks.

Return
{
   "awardedMarks":0,
   "feedback":"..."
}
`;

        const aiResult = await model.generateContent(prompt);
        let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        
        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        console.error("🚨 CORRECTOR CRASH:", err);
        res.status(500).json({ error: "Failed to correct answer.", details: err.message });
    }
};

// 4. ASSIGNMENT DUE DATE ALERTS (Missing/Pending Tracker)
export const generateAssignmentReminders = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "Generate Assignment Reminders");

        const dbResult = await pool.query(`
            SELECT s.full_name AS student, a.title AS task, a.assessment_date AS due
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            WHERE ar.is_absent = true OR ar.marks_obtained IS NULL
            LIMIT 5;
        `);

        const missingAssignments = dbResult.rows;

        const prompt = `
Write a professional email reminder for parents.

Requirements
- Maximum 3 short paragraphs.
- Friendly.
- Professional.
- Encouraging.
- Mention assignment submission politely.
- Use placeholder [Student Name].
- Use placeholder [Assignment Name].

Do not use markdown.
Do not use HTML.
Do not use code blocks.
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ reminderEmail: aiResult.text, list: missingAssignments });
    } catch (err) {
        console.error("🚨 DUE DATE ALERTS CRASH:", err);
        res.status(500).json({ error: "Failed to generate reminders.", details: err.message });
    }
};

// 5. ASSIGNMENT COMPLETION ALERTS
export const getAssignmentCompletionAlerts = async (req, res) => {
    const { userInfo } = req.body;
    const teacherId = userInfo?.id || 3;

    try {
        await logAIUsage(userInfo, "View Completion Alerts");

        // Query database for submitted assignments and calculate completion metrics
        const dbResult = await pool.query(`
            SELECT a.title AS task, COUNT(ar.student_id) as total_submitted, ROUND(AVG(ar.percentage), 2) as avg_score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            WHERE a.teacher_id = $1 AND ar.marks_obtained IS NOT NULL
            GROUP BY a.title
            ORDER BY a.assessment_date DESC
            LIMIT 5;
        `, [teacherId]);

        const completions = dbResult.rows;

        const prompt = `
You are an AI teaching assistant.

Review the following assignment statistics.
${JSON.stringify(completions)}

Generate a short report.
Include:
- Submission trend
- Average performance
- Students requiring attention

Maximum 3 bullet points.
No markdown.
No HTML.
No LaTeX.
Plain text only.
`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ completionAlert: aiResult.text, data: completions });
    } catch (err) {
        console.error("🚨 COMPLETION ALERTS CRASH:", err);
        res.status(500).json({ error: "Failed to fetch completion alerts.", details: err.message });
    }
};

// 6. VIRTUAL SLATE AI PROCESSOR 
export const processVirtualSlateContent = async (req, res) => {
    const { rawText, action = "format", userInfo } = req.body;
    
    if (!rawText) return res.status(400).json({ error: "Virtual slate text is required." });

    try {
        await logAIUsage(userInfo, `Virtual Slate: ${action}`);
        
        let instruction = action === "summarize" 
            ? "Summarize these rough virtual slate notes clearly." 
            : "Format these rough virtual slate notes into clean, structured bullet points for students.";
            
        const prompt = `
You are an AI classroom assistant.

Teacher's rough notes:
"${rawText}"

Task
${instruction}

Formatting Rules
- Create clean notes.
- Use headings.
- Use bullet points.
- Do not use markdown code blocks.
- Do not use HTML.
- Do not use ASCII art.
- Do not use LaTeX.
- Do not use $.
- Make notes suitable for classroom teaching.
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ processedContent: aiResult.text });
    } catch (err) {
        console.error("🚨 VIRTUAL SLATE CRASH:", err);
        res.status(500).json({ error: "Failed to process virtual slate.", details: err.message });
    }
};

// 7 & 8. STUDENT ANALYTICS
export const getSingleStudentAnalytics = async (req, res) => {
    const { studentName = "Aarav", subject = "all", userInfo } = req.body;
    try {
        await logAIUsage(userInfo, `View Student Analytics (${subject})`);

        let query = `
            SELECT a.title AS test_name, a.assessment_type AS type, ar.percentage AS score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            WHERE s.full_name ILIKE $1
        `;
        let params = [`%${studentName}%`];

        if (subject !== "all") {
            query += ` AND a.assessment_type ILIKE $2`;
            params.push(`%${subject}%`);
        }

        query += ` ORDER BY a.assessment_date DESC LIMIT 5;`;
        const dbResult = await pool.query(query, params);

        let studentData = dbResult.rows;
        if (studentData.length === 0) {
            studentData = [{ test_name: "Mock Test", type: "Exam", score: 75 }];
        }
        
        const prompt = `
You are helping a teacher analyse student performance.

Student Name
${studentName}

Performance Data
${JSON.stringify(studentData)}

Generate
1. Overall Performance
2. Strengths
3. Weaknesses
4. One Recommendation

Maximum 4 bullet points.
Plain text only.
No markdown.
No HTML.
No LaTeX.
No $ symbols.
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ analysis: aiResult.text, chartData: studentData });
    } catch (err) {
        console.error("🚨 STUDENT ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to analyze student.", details: err.message });
    }
};

// 7 & 8. CLASS PERFORMANCE ANALYTICS
export const getClassAnalytics = async (req, res) => {
    const { subject = "all", userInfo } = req.body;
    const teacherId = userInfo?.id || 3;

    try {
        await logAIUsage(userInfo, `View Class Analytics (${subject})`);

        let query = `
            SELECT s.full_name AS student, ROUND(AVG(ar.percentage), 2) AS overall_score
            FROM sgs_assessment_results ar
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            WHERE a.teacher_id = $1
        `;
        let params = [teacherId];

        if (subject !== "all") {
            query += ` AND a.assessment_type ILIKE $2`;
            params.push(`%${subject}%`);
        }

        query += ` GROUP BY s.full_name ORDER BY overall_score DESC;`;
        const dbResult = await pool.query(query, params);

        let classData = dbResult.rows;
        if (classData.length === 0) {
            classData = [{ student: "No Data", overall_score: 0 }];
        }

        const prompt = `
You are analysing an entire classroom.

Data
${JSON.stringify(classData)}

Generate
- Overall class performance
- Strong performers
- Students needing attention
- Teaching recommendation

Maximum 5 bullet points.
Plain text only.
No markdown.
No HTML.
No LaTeX.
No $.
`;
    
        const aiResult = await model.generateContent(prompt);
        res.json({ analyticsReport: aiResult.text, data: classData });
    } catch (err) {
        console.error("🚨 CLASS ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to generate class analytics.", details: err.message });
    }
};

// 9 & 10. LANGUAGE TRANSLATOR 
export const translateText = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and target language required" });

    try {
        await logAIUsage(userInfo, "Translate Text");
        
        const prompt = `
Translate the following text into ${targetLanguage}.

Requirements
- Return ONLY the translated text.
- Do not explain.
- Do not add quotation marks.
- Preserve formatting.
- Preserve bullet points if present.
- Do not use markdown.

Text
"${text}"
`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.text.trim() });
    } catch (err) {
        console.error("🚨 TRANSLATION CRASH:", err);
        res.status(500).json({ error: "Failed to translate text.", details: err.message });
    }
};

// 11. UNIFIED TEACHER CHATBOT (UPGRADED WITH AUTO LANGUAGE DETECTION)
export const teacherChatbot = async (req, res) => {
    // UPDATED: targetLanguage parameter has been removed completely
    const { message, userInfo } = req.body; 
    
    // Use the user's ID to fetch their specific chat history
    const userId = userInfo?.id || 3; 

    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        await logAIUsage(userInfo, "Teacher AI Chatbot");

        // 1. Fetch the last 10 messages from the database to build "Memory"
        const historyResult = await pool.query(
            `SELECT role, message_content FROM (
                SELECT role, message_content, created_at 
                FROM ai_chat_messages 
                WHERE student_id = $1 
                ORDER BY created_at DESC 
                LIMIT 10
            ) sub ORDER BY created_at ASC`,
            [userId]
        );

        // Format history exactly how Gemini expects it
        const chatHistory = historyResult.rows.map(row => ({
            role: row.role === 'ai' ? 'model' : 'user', 
            parts: [{ text: row.message_content }]
        }));

        // 2. Initialize Gemini with STRICT Language & Script Rules
        const prompt = `
You are SGS AI Teacher Assistant.

You help teachers with
- Lesson Planning
- Question Papers
- Student Assessment
- Classroom Management
- Curriculum Design
- Translation
- Parent Communication

Conversation History
${chatHistory
    .map(chat => `${chat.role === "model" ? "Assistant" : "Teacher"}: ${chat.parts[0].text}`)
    .join("\n")}

Teacher's latest question:
"${message}"

IMPORTANT RESPONSE RULES:
- AUTO-LANGUAGE DETECTION: Analyze the language and script of the Teacher's latest question. You MUST reply entirely in that exact same language and script. (e.g., if the question is in Hindi, reply in Hindi; if Telugu, reply in Telugu; if English, reply in English).
- Be concise but complete.
- Never use Markdown tables.
- Never use Markdown code blocks.
- Never use HTML.
- Never use ASCII diagrams.
- Never use LaTeX.
- Never use $ or $$.
- Write mathematical expressions in plain text.
- Use headings and bullet points where helpful.
`;
    
        // 3. Save the user's NEW message to the database
        await pool.query(
            `INSERT INTO ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, 'user', message]
        );

        // 4. Send the message to Gemini
        const aiResult = await model.generateContent(prompt);
        const aiReply = aiResult.text;

        // 5. Save the AI's reply back to the database
        await pool.query(
            `INSERT INTO ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, 'ai', aiReply]
        );

        res.json({ reply: aiReply });
    } catch (err) {
        console.error("🚨 CHATBOT CRASH:", err);
        res.status(500).json({ error: "Chat failed.", details: err.message });
    }
};

// ==========================================
// 12. GOOGLE CLOUD TEXT-TO-SPEECH CONTROLLER (STRICT VOICE MAPPING)
// ==========================================
export const handleTextToSpeech = async (req, res) => {
    const { text, language = "English" } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Text is required for speech synthesis" });
    }

    try {
        // 1. Default to English
        let finalLangCode = "en-IN";
        let finalVoiceName = "en-IN-Neural2-B"; 

        // 2. 🔥 SMART SCRIPT DETECT + EXACT VOICE NAMES
        // Google Cloud REQUIRES the exact 'name' for regional languages to work properly.
        if (/[\u0C00-\u0C7F]/.test(text)) { 
            // Telugu Detected
            finalLangCode = "te-IN"; finalVoiceName = "te-IN-Standard-A"; 
        } else if (/[\u0C80-\u0CFF]/.test(text)) { 
            // Kannada Detected
            finalLangCode = "kn-IN"; finalVoiceName = "kn-IN-Standard-A"; 
        } else if (/[\u0D00-\u0D7F]/.test(text)) { 
            // Malayalam Detected
            finalLangCode = "ml-IN"; finalVoiceName = "ml-IN-Standard-A"; 
        } else if (/[\u0980-\u09FF]/.test(text)) { 
            // Bengali Detected
            finalLangCode = "bn-IN"; finalVoiceName = "bn-IN-Standard-A"; 
        } else if (/[\u0B80-\u0BFF]/.test(text)) { 
            // Tamil Detected
            finalLangCode = "ta-IN"; finalVoiceName = "ta-IN-Standard-A"; 
        } else if (/[\u0900-\u097F]/.test(text)) { 
            // Devanagari Detected (Shared by Hindi & Marathi)
            // If the user selected Marathi in the dropdown, force Marathi voice
            if (language === "Marathi") {
                finalLangCode = "mr-IN"; finalVoiceName = "mr-IN-Standard-A";
            } else {
                finalLangCode = "hi-IN"; finalVoiceName = "hi-IN-Neural2-A";
            }
        }

        // 3. Send BOTH languageCode and name to prevent crashes
        const request = {
            input: { text: text },
            voice: { languageCode: finalLangCode, name: finalVoiceName }, 
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        
        res.json({
            status: "success",
            audioData: response.audioContent.toString('base64')
        });

    } catch (err) {
        console.error("🚨 GOOGLE TTS CRASH:", err);
        res.status(500).json({ error: "Voice generation failed", details: err.message });
    }
};