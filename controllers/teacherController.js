import { logAIUsage } from '../utils/aiTracker.js';
import model from '../config/aiConfig.js';
import pool from "../config/db.js";
import textToSpeech from '@google-cloud/text-to-speech'; 

// Google Cloud TTS Client Initialize using your API KEY from .env
const ttsClient = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_TTS_API_KEY
});

// 🌍 Google Cloud Voice Mapping
const googleVoiceMap = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Telugu": "te-IN",
    "Telegu": "te-IN", 
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Oriya": "hi-IN", 
    "Sanskrit": "hi-IN" 
};

// ==========================================
// 1. AUTO LESSON PLANNER (CBSE AP UNIFIED FORMAT)
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
        const result = await pool.query(
            'SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', 
            [chapterId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];
        const finalTopic = topic && topic.trim() !== '' ? topic : chapter_name;

        const prompt = `
You are an expert CBSE master teacher creating a highly detailed, practical guide for a faculty member in Andhra Pradesh.

Topic: "${finalTopic}"
Class: ${classLevel}
Subject: ${subject}
Duration: ${durationMinutes} Minutes

Use ONLY the following textbook content:
"""
${full_text_content}
"""

CRITICAL INSTRUCTION:
Do NOT write vague summaries. You MUST write exact teaching scripts, real-world examples, and specific methodologies. Do NOT use markdown bolding (**) or asterisks.

REQUIRED EXACT STRUCTURE:

Lesson Plan: ${finalTopic}

I. Pedagogical Intent & Target Outcomes
• Learning Objectives: [Write 3 specific, measurable outcomes]
• Chapter Gist: [Brief summary of core themes]
• Keywords: [List 4-5 core vocabulary words]

II. Prerequisite Diagnostic & Hook Activity
• The Hook: [Write the EXACT script/diagnostic question the teacher must ask to test prior knowledge]

III. Micro-Period Distribution Matrix
Period / Time | Core Sub-Topic Target | Active Methodology & Strategies
[Time segment] | [Specific sub-topic] | [Detailed explanation script, real-world analogies, and exactly what the teacher should do]
[Time segment] | [Specific sub-topic] | [Detailed explanation script, real-world analogies, and exactly what the teacher should do]
[Time segment] | [Specific sub-topic] | [Detailed explanation script, real-world analogies, and exactly what the teacher should do]

IV. Inclusive Infrastructure & Cross-Curricular Integration
• Art Integration / Differentiation: [1 specific strategy to integrate art or support diverse learners]

V. Assessment Framework
• HOTS Prompt: [Write 1 challenging Higher Order Thinking Skills question to ask the class]
• Home Assignment: [1 highly specific homework assignment related to the textbook]

VI. Post-Lesson Reflective Log
[To be filled out post-delivery - leave a blank placeholder line here]
`;

        const aiResult = await model.generateContent(prompt);
        const lessonPlanText = aiResult.text;

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
// 2. AUTO QUESTION PAPER GENERATOR (CBSE AP BLUEPRINT)
// ==========================================
export const generateQuestionPaper = async (req, res) => {
    const { 
        chapterId, 
        difficulty = 'Medium', 
        questionType = 'All', 
        totalMarks = 50,
        classLevel = 'Class 8', 
        subject = 'Select',
        userInfo 
    } = req.body;

    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    const validMarks = [10, 20, 30, 50, 70, 80, 100];
    if (!validMarks.includes(parseInt(totalMarks))) {
        return res.status(400).json({ error: "Total marks must be valid." });
    }

    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    const validatedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'Medium';

    try {
        const result = await pool.query(
            'SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', 
            [chapterId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Chapter not found in database" });
        }
        
        const { chapter_name, full_text_content } = result.rows[0];

        const prompt = `
You are an expert school exam paper setter.
Create a highly accurate, classroom-ready Question Paper and Answer Key based STRICTLY on the provided textbook content.

EXAM PARAMETERS:
Chapter: "${chapter_name}"
Class: ${classLevel}
Subject: ${subject}
Difficulty: ${validatedDifficulty}
Total Marks: ${totalMarks}

TEXTBOOK CONTENT TO USE:
"""
${full_text_content}
"""

CRITICAL INSTRUCTIONS:
1. The sum of the marks for all questions MUST add up exactly to ${totalMarks}. Distribute the marks proportionally across Sections A to E based on standard CBSE blueprints.
2. Base all questions strictly on the provided text. Do not invent facts.
3. Complexity MUST match the ${validatedDifficulty} level.
4. FORMAT: Return a clean, human-readable Question Paper layout. Do NOT return JSON. Do NOT use markdown bolding (**) or asterisks.

REQUIRED EXACT STRUCTURE:

SGS
PERIODIC / CLASS TEST – 2026-27
Subject: ${subject}  |  Class: ${classLevel}
Chapter: ${chapter_name}  |  Time: Adjust based on marks  |  Maximum Marks: ${totalMarks}
Name: ________________________ | Roll No.: ________________
Section: __________ | Date: ________________

General Instructions
All questions are compulsory.
The question paper consists of Sections A, B, C, D and E.

SECTION A – Objective Type Questions (1 Mark Each)
[Generate MCQs, fill-in items, and Assertion-Reasoning pairings]

SECTION B – Very Short Answer Questions (2 Marks Each)
[Generate direct questions. Answers should be 30 to 50 words]

SECTION C – Short Answer Questions (3 Marks Each)
[Generate brief explanations or mid-tier logic. Answers should be 50 to 80 words]

SECTION D – Long Answer Questions (5 Marks Each)
[Generate detailed essay-style questions. Answers should be 80 to 120 words. Include strict internal choices like 'Answer this OR that']

SECTION E – Case-Based / Source (4 Marks Each)
[Generate integrated competency prompts evaluating a text block or case snippet based on the content]

— END OF QUESTION PAPER —

===================================================================
ANSWER KEY & MARKING SCHEME
===================================================================
[Provide exact answers for all questions enforcing the word limits.]
`;

        const aiResult = await model.generateContent(prompt);
        const paperText = aiResult.text;
        
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard - Auto Test", 
            `Generate AP CBSE Question Paper (${validatedDifficulty} - ${totalMarks} Marks)`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        res.json({ questionPaper: paperText });

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", "Auto Answer Sheet Corrector", aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", "Assignment Due Date Alerts", aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", "Assignment Completion Alerts", aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", `Virtual Slate (${action})`, aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", `Student Analytics (${subject})`, aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", `Class Analytics (${subject})`, aiResult.usageMetadata || aiResult.response?.usageMetadata);

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
        
        await logAIUsage(userInfo, "Teacher Dashboard", `Language Translator`, aiResult.usageMetadata || aiResult.response?.usageMetadata);

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

        await logAIUsage(userInfo, "Teacher Dashboard", "Teacher AI Chatbot", aiResult.usageMetadata || aiResult.response?.usageMetadata);

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