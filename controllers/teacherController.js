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
// 1. AUTO LESSON PLANNER (STRICT TEACHER-FOCUSED FORMAT)
// ==========================================
export const generateLessonPlan = async (req, res) => {
    const { 
        chapterId, 
        durationMinutes = 45, 
        userInfo,
        classLevel = 'Not specified',
        subject = 'Not specified',
        topic
    } = req.body;

    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];
        const finalTopic = topic && topic.trim() !== '' ? topic : chapter_name;

        // ✨ REVERTED TO YOUR EXACT PREFERRED SAMPLE ✨
        const prompt = `
You are an expert school teacher creating a practical guide for another faculty member.

Create a concise, classroom-ready lesson plan for:
Topic: "${finalTopic}"
Class: ${classLevel}
Subject: ${subject}
Duration: ${durationMinutes} Minutes

Use ONLY the following textbook content to create the lesson plan:
"${full_text_content}"

IMPORTANT:
This lesson plan is strictly for the faculty to use in the classroom. It must follow EXACTLY the structure and style below. Do not add any extra sections.

Lesson Plan: ${finalTopic}

Lesson Metadata
Class: ${classLevel}
Topic: ${finalTopic}
Duration: ${durationMinutes} Minutes
Subject: ${subject}

Learning Objectives
By the end of this lesson, students will be able to:
• [Objective 1]
• [Objective 2]
• [Objective 3]

Minute-by-Minute Timeline
Time (Mins) | Topic / Core Concept | Teaching Strategy / Activity
[Start] - [End] | [Topic] | [Strategy helping the teacher explain the concept]
[Start] - [End] | [Topic] | [Strategy helping the teacher explain the concept]
[Start] - [End] | [Topic] | [Strategy helping the teacher explain the concept]

(Divide the lesson logically. Ensure the total duration adds up exactly to ${durationMinutes} minutes. Make activities highly practical for the teacher to execute.)

Key Board Summary
• [Important definition or concept to write on the board]
• [Important keyword]
• [Important fact]

Quick Assessment / Homework
1. [Definition / Recall question]
2. [Short-answer question]
3. [Application-based or Homework question]

FORMAT RULES:
- Use clear headings exactly like the structure above.
- Use plain bullet points (•) where appropriate.
- For the Minute-by-Minute Timeline, strictly use the pipe-separated text format shown above. Do NOT use standard Markdown tables (no |---|---| rows).
- Do NOT use Markdown bolding (**text**) or asterisks (*) to prevent UI formatting glitches.
- Keep the teaching strategies focused on helping the faculty member deliver the class effectively.
- Return ONLY the lesson plan text.
`;

        const aiResult = await model.generateContent(prompt);
        const lessonPlanText = aiResult.text;

        // ✅ Log AI Usage
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Generate Lesson Plan", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        await pool.query(
            `INSERT INTO sgs_lesson_plans (teacher_id, title, chapter_id, chapter_text, duration_minutes, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [teacherId, `AI Plan: ${finalTopic}`, chapterId, chapter_name, durationMinutes]
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
    // Extracting fields mapping to your frontend UI
    const { 
        chapterId, 
        difficulty = 'Medium', 
        questionType = 'All', 
        totalMarks = 50, 
        userInfo 
    } = req.body;

    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    // Validate that marks strictly follow your requested tiers
    const validMarks = [10, 20, 30, 50, 70, 100];
    if (!validMarks.includes(parseInt(totalMarks))) {
        return res.status(400).json({ error: "Total marks must be exactly 10, 20, 30, 50, 70, or 100." });
    }

    try {
        // 1. Fetch the chapter content from your database
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];

        // 2. Determine exact question types based on frontend selection
        let typesInstruction = "";
        if (questionType === "All") {
            typesInstruction = "MCQ, True/False, Short Q/A, Long Q/A, and Matching words";
        } else {
            typesInstruction = questionType; // e.g., "MCQ" or "Short Answer"
        }

        // 3. The AI Master Prompt for Question Papers
        const prompt = `
You are an expert school exam paper setter.
Create a highly accurate, challenging, and classroom-ready question paper based STRICTLY on the provided textbook content.

EXAM PARAMETERS:
Chapter: "${chapter_name}"
Difficulty: ${difficulty}
Total Marks: ${totalMarks}
Allowed Question Types: ${typesInstruction}

TEXTBOOK CONTENT TO USE:
"""
${full_text_content}
"""

CRITICAL INSTRUCTIONS:
1. The sum of the "marks" for all questions MUST add up exactly to ${totalMarks}. Do not fall short.
2. If the "Allowed Question Types" is "All", you MUST include a varied mixture of MCQ, True/False, Short Q/A, Long Q/A, and Matching words.
3. If a specific type is requested (e.g., "MCQ"), generate ONLY that type of question.
4. Base all questions strictly on the provided text. Do not hallucinate outside facts.
5. Return ONLY valid JSON. Do NOT use markdown code blocks (\`\`\`json). Do NOT add any conversational text.

Return EXACTLY this JSON structure:
{
  "paperTitle": "Chapter Assessment: ${chapter_name}",
  "chapter": "${chapter_name}",
  "difficulty": "${difficulty}",
  "totalMarks": ${totalMarks},
  "questions": [
    {
      "questionNumber": 1,
      "type": "MCQ", // Or True/False, Short Q/A, Long Q/A, Matching words
      "questionText": "...",
      "marks": 2, // Assign realistic marks based on the difficulty/length
      "options": ["A", "B", "C", "D"], // Include ONLY if type is MCQ
      "matchingPairs": [{"left": "...", "right": "..."}], // Include ONLY if type is Matching words
      "correctAnswer": "Exact correct text or expected answer"
    }
  ]
}
`;

        // 4. Generate with Gemini
        const aiResult = await model.generateContent(prompt);
        
        // 5. Log AI Usage tracking
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard - Auto Test", 
            `Generate Question Paper (${difficulty} - ${totalMarks} Marks)`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        // 6. Clean and parse the JSON safely
        let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error("AI did not return a valid JSON format.");
        }
        
        const examData = JSON.parse(jsonMatch[0]);

        // 7. Send the clean JSON back to the frontend
        res.json({ questionPaper: examData });

    } catch (err) {
        console.error("🚨 QUESTION PAPER CRASH:", err);
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

        let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        
        res.json(JSON.parse(jsonMatch[0]));
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