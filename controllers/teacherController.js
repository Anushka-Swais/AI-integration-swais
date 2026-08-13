import { logAIUsage } from '../utils/aiTracker.js';
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

// ==========================================
// 1. AUTO LESSON PLANNER
// ==========================================
export const generateLessonPlan = async (req, res) => {
    const { chapterId, durationMinutes = 45, userInfo } = req.body;
    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
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

        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Generate Lesson Plan", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

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

// ==========================================
// 2. AUTO QUESTION PAPER GENERATOR 
// ==========================================
export const generateQuestionPaper = async (req, res) => {
    const { chapterId, difficulty = "Medium", totalMarks = 20, questionType = "ALL", userInfo } = req.body;
    const teacherId = userInfo?.id || 3; 
    
    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const content = result.rows[0].full_text_content;
        const chapterName = result.rows[0].chapter_name || `Chapter ${chapterId}`;
        
        let typeInstruction = "";
        let marksInstruction = "";
        const typeUpper = (questionType || "ALL").toUpperCase();
        const tMarks = Number(totalMarks);

        // 🧠 Dynamic Math Engine for AI Prompting
        if (typeUpper === "ALL" || typeUpper === "MIXED") {
            // Calculate proportional split for Mixed Types
            let mcqCount = Math.max(1, Math.round(tMarks * 0.10));
            let tfCount = Math.max(1, Math.round(tMarks * 0.10));
            let fibCount = Math.max(1, Math.round(tMarks * 0.10));
            let shortCount = Math.max(1, Math.floor((tMarks * 0.30) / 2));
            
            let marksSoFar = (mcqCount * 1) + (tfCount * 1) + (fibCount * 1) + (shortCount * 2);
            let remainingMarks = tMarks - marksSoFar;
            
            let longCount = Math.max(1, Math.floor(remainingMarks / 4));
            let lastLongMarks = remainingMarks - ((longCount - 1) * 4); 

            typeInstruction = `🚨 CRITICAL: Generate a balanced exam paper containing exactly these 5 types:
1. ${mcqCount} Multiple Choice (MCQ) Questions
2. ${tfCount} True/False Questions
3. ${fibCount} Fill in the Blanks Questions
4. ${shortCount} Short Answer Questions
5. ${longCount} Long Answer Questions`;

            marksInstruction = `Assign marks EXACTLY as follows to reach ${tMarks} marks:
- MCQs: 1 mark each
- True/False: 1 mark each
- Fill in the Blanks: 1 mark each
- Short Answers: 2 marks each
- Long Answers: ${longCount - 1} questions worth 4 marks each, and 1 final Long Answer question worth ${lastLongMarks} marks.
TOTAL SUM MUST BE EXACTLY ${tMarks}.`;
        
        } else if (["MCQ", "QUIZ"].includes(typeUpper)) {
            typeInstruction = `🚨 CRITICAL: Generate ONLY Multiple Choice Questions (MCQs). Do not include any other question types.`;
            marksInstruction = `Each MCQ is worth exactly 1 mark. You MUST generate EXACTLY ${tMarks} questions.`;
            
        } else if (["TRUE/FALSE", "TRUE FALSE", "TRUE-FALSE"].includes(typeUpper)) {
            typeInstruction = `🚨 CRITICAL: Generate ONLY True or False questions. Do not include any other question types.`;
            marksInstruction = `Each True/False question is worth exactly 1 mark. You MUST generate EXACTLY ${tMarks} questions.`;
            
        } else if (["FILL IN THE BLANKS", "FIB"].includes(typeUpper)) {
            typeInstruction = `🚨 CRITICAL: Generate ONLY Fill in the Blanks questions. Do not include any other question types.`;
            marksInstruction = `Each Fill in the Blanks question is worth exactly 1 mark. You MUST generate EXACTLY ${tMarks} questions.`;
            
        } else if (["SHORT ANSWER", "SHORT Q/A", "SHORT"].includes(typeUpper)) {
            const shortQCount = Math.floor(tMarks / 2); 
            const remainder = tMarks % 2;
            const lastMarks = 2 + remainder;
            typeInstruction = `🚨 CRITICAL: Generate ONLY Short Answer questions.`;
            marksInstruction = `You MUST generate EXACTLY ${shortQCount} questions. ${shortQCount - 1} questions must be worth 2 marks each, and the final question must be worth ${lastMarks} marks to equal exactly ${tMarks} total marks.`;
            
        } else if (["LONG ANSWER", "LONG Q/A", "LONG"].includes(typeUpper)) {
            const longQCount = Math.max(1, Math.floor(tMarks / 4));
            const lastMarks = tMarks - ((longQCount - 1) * 4);
            typeInstruction = `🚨 CRITICAL: Generate ONLY Long Answer questions.`;
            marksInstruction = `You MUST generate EXACTLY ${longQCount} questions. ${longQCount - 1} questions must be worth 4 marks each, and the final question must be worth ${lastMarks} marks to equal exactly ${tMarks} total marks.`;
            
        } else {
            typeInstruction = `Generate ONLY ${questionType} questions.`;
            marksInstruction = `The total marks MUST equal exactly ${tMarks}.`;
        }
        
        const prompt = `
You are an experienced examination paper setter.

Generate a ${difficulty} level question paper based ONLY on the Chapter Content provided below.

${marksInstruction}
${typeInstruction}

GLOBAL RULES:
- NEVER use the phrase "According to Textbook", "Based on the text", or "According to the chapter" in the questions. Write them as independent, objective questions.
- For Short Answer questions, the expected answer MUST be a single line and NOT exceed 180 characters.
- For Long Answer questions, the expected answer MUST NOT exceed 2000 characters.
- For Fill in the Blanks, use "_____" to denote the blank space.
- Leave the "options" array empty [] for True/False, Fill in the Blanks, Short Answers, and Long Answers.

Return ONLY valid JSON.
Do NOT return markdown.
Do NOT use backticks around the JSON.
Do NOT explain the JSON.

Return exactly this structure:
{
  "paperTitle": "Generated Test",
  "totalMarks": ${tMarks},
  "questions": [
    {
      "questionText": "...",
      "type": "MCQ | True/False | Fill in the Blanks | Short Answer | Long Answer", 
      "options": ["...", "...", "...", "..."], 
      "answer": "...",
      "marks": 1
    }
  ]
}

Chapter Content
"${content}"
`;
        
        const aiResult = await model.generateContent(prompt);
        
        // ✅ Log AI Usage
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            `Generate Exam Paper (${questionType})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        // 🔥 CRITICAL FIX: Bulletproof JSON Extraction (Ignores backticks/markdown completely)
        let rawText = aiResult.text;
        const startIndex = rawText.indexOf('{');
        const endIndex = rawText.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
            throw new Error("AI did not return a valid JSON format. Raw output: " + rawText);
        }
        
        const jsonString = rawText.substring(startIndex, endIndex + 1);
        const generatedPaper = JSON.parse(jsonString);

        // ✅ NEW: Save the generated quiz to the Assessment table as a 'Draft'
        await pool.query(
            `INSERT INTO sgs_assessments (teacher_id, title, assessment_type, assessment_category, assessment_date, total_marks, publish_status, created_at)
             VALUES ($1, $2, $3, 'Academic', CURRENT_DATE, $4, 'Draft', CURRENT_TIMESTAMP)`,
            [teacherId, `AI Auto Test: ${chapterName}`, questionType, tMarks]
        );

        res.json(generatedPaper);
    } catch (err) {
        console.error("🚨 EXAM CRASH:", err);
        res.status(500).json({ error: "Failed to generate question paper.", details: err.message });
    }
};

// ==========================================
// 3. AUTO ANSWER SHEET CORRECTOR 
// ==========================================
export const autoCorrectAnswer = async (req, res) => {
    const { question, studentAnswer, maxMarks, rubric, userInfo } = req.body;
    if (!question || !studentAnswer || !maxMarks || !rubric) return res.status(400).json({ error: "Missing required fields" });

    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Auto Answer Sheet Corrector", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        // 🔥 CRITICAL FIX: Applied to corrector as well!
        let rawText = aiResult.text;
        const startIndex = rawText.indexOf('{');
        const endIndex = rawText.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
            throw new Error("AI did not return a valid JSON format. Raw output: " + rawText);
        }
        
        const jsonString = rawText.substring(startIndex, endIndex + 1);
        res.json(JSON.parse(jsonString));

    } catch (err) {
        console.error("🚨 CORRECTOR CRASH:", err);
        res.status(500).json({ error: "Failed to correct answer.", details: err.message });
    }
};

// ==========================================
// 4. ASSIGNMENT DUE DATE ALERTS 
// ==========================================
export const generateAssignmentReminders = async (req, res) => {
    const { userInfo } = req.body;
    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Assignment Due Date Alerts", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ reminderEmail: aiResult.text, list: missingAssignments });
    } catch (err) {
        console.error("🚨 DUE DATE ALERTS CRASH:", err);
        res.status(500).json({ error: "Failed to generate reminders.", details: err.message });
    }
};

// ==========================================
// 5. ASSIGNMENT COMPLETION ALERTS
// ==========================================
export const getAssignmentCompletionAlerts = async (req, res) => {
    const { userInfo } = req.body;
    const teacherId = userInfo?.id || 3;

    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Assignment Completion Alerts", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ completionAlert: aiResult.text, data: completions });
    } catch (err) {
        console.error("🚨 COMPLETION ALERTS CRASH:", err);
        res.status(500).json({ error: "Failed to fetch completion alerts.", details: err.message });
    }
};

// ==========================================
// 6. VIRTUAL SLATE AI PROCESSOR 
// ==========================================
export const processVirtualSlateContent = async (req, res) => {
    const { rawText, action = "format", userInfo } = req.body;
    
    if (!rawText) return res.status(400).json({ error: "Virtual slate text is required." });

    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            `Virtual Slate (${action})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ processedContent: aiResult.text });
    } catch (err) {
        console.error("🚨 VIRTUAL SLATE CRASH:", err);
        res.status(500).json({ error: "Failed to process virtual slate.", details: err.message });
    }
};

// ==========================================
// 7. STUDENT ANALYTICS
// ==========================================
export const getSingleStudentAnalytics = async (req, res) => {
    const { studentName = "Aarav", subject = "all", userInfo } = req.body;
    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            `Student Analytics (${subject})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ analysis: aiResult.text, chartData: studentData });
    } catch (err) {
        console.error("🚨 STUDENT ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to analyze student.", details: err.message });
    }
};

// ==========================================
// 8. CLASS PERFORMANCE ANALYTICS
// ==========================================
export const getClassAnalytics = async (req, res) => {
    const { subject = "all", userInfo } = req.body;
    const teacherId = userInfo?.id || 3;

    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            `Class Analytics (${subject})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ analyticsReport: aiResult.text, data: classData });
    } catch (err) {
        console.error("🚨 CLASS ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to generate class analytics.", details: err.message });
    }
};

// ==========================================
// 9 & 10. LANGUAGE TRANSLATOR 
// ==========================================
export const translateText = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and target language required" });

    try {
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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            `Language Translator`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ translation: aiResult.text.trim() });
    } catch (err) {
        console.error("🚨 TRANSLATION CRASH:", err);
        res.status(500).json({ error: "Failed to translate text.", details: err.message });
    }
};

// ==========================================
// 11. UNIFIED TEACHER CHATBOT 
// ==========================================
export const teacherChatbot = async (req, res) => {
    const { message, userInfo } = req.body; 
    const userId = userInfo?.id || 3; 

    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
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

        const chatHistory = historyResult.rows.map(row => ({
            role: row.role === 'ai' ? 'model' : 'user', 
            parts: [{ text: row.message_content }]
        }));

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
    
        await pool.query(
            `INSERT INTO ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, 'user', message]
        );

        const aiResult = await model.generateContent(prompt);
        const aiReply = aiResult.text;

        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Teacher AI Chatbot", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

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
// 12. GOOGLE CLOUD TEXT-TO-SPEECH CONTROLLER 
// ==========================================
export const handleTextToSpeech = async (req, res) => {
    const { text, language = "English", userInfo } = req.body; 

    if (!text) {
        return res.status(400).json({ error: "Text is required for speech synthesis" });
    }

    try {
        let finalLangCode = "en-IN";
        let finalVoiceName = "en-IN-Neural2-B"; 

        if (/[\u0C00-\u0C7F]/.test(text)) { 
            finalLangCode = "te-IN"; finalVoiceName = "te-IN-Standard-A"; 
        } else if (/[\u0C80-\u0CFF]/.test(text)) { 
            finalLangCode = "kn-IN"; finalVoiceName = "kn-IN-Standard-A"; 
        } else if (/[\u0D00-\u0D7F]/.test(text)) { 
            finalLangCode = "ml-IN"; finalVoiceName = "ml-IN-Standard-A"; 
        } else if (/[\u0980-\u09FF]/.test(text)) { 
            finalLangCode = "bn-IN"; finalVoiceName = "bn-IN-Standard-A"; 
        } else if (/[\u0B80-\u0BFF]/.test(text)) { 
            finalLangCode = "ta-IN"; finalVoiceName = "ta-IN-Standard-A"; 
        } else if (/[\u0900-\u097F]/.test(text)) { 
            if (language === "Marathi") {
                finalLangCode = "mr-IN"; finalVoiceName = "mr-IN-Standard-A";
            } else {
                finalLangCode = "hi-IN"; finalVoiceName = "hi-IN-Neural2-A";
            }
        }

        const request = {
            input: { text: text },
            voice: { languageCode: finalLangCode, name: finalVoiceName }, 
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        
        // ✅ NEW: Log the TTS feature without tokens
        await logAIUsage(userInfo, "Teacher Dashboard", "Text-to-Speech (Listen)", null);

        res.json({
            status: "success",
            audioData: response.audioContent.toString('base64')
        });

    } catch (err) {
        console.error("🚨 GOOGLE TTS CRASH:", err);
        res.status(500).json({ error: "Voice generation failed", details: err.message });
    }
};