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
// 1. AUTO LESSON PLANNER (GODAVARI DEVI SARAF FORMAT)
// ==========================================
export const generateLessonPlan = async (req, res) => {
    const { 
        chapterId, 
        durationMinutes = 45, 
        userInfo,
        classLevel = 'Not specified',
        section = 'Not specified',
        subject = 'Not specified',
        topic,
        designation = 'Teacher',
        noOfPeriods = 'Not specified',
        dateOfCommencement = 'Not specified',
        expectedCompletion = 'Not specified',
        actualCompletion = 'Not specified'
    } = req.body;
    
    const teacherId = userInfo?.id || 3;
    const teacherName = userInfo?.name || 'Not specified';

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        const schoolResult = await pool.query('SELECT school_name FROM sgs_school_name LIMIT 1');
        const school_name = schoolResult.rows[0]?.school_name || '';

        const result = await pool.query(
            'SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', 
            [chapterId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];
        const finalTopic = topic && topic.trim() !== '' ? topic : chapter_name;

        const prompt = `
You are an expert, highly experienced school teacher. Your task is to write a comprehensive and deeply detailed lesson plan for the topic "${finalTopic}".
You MUST base your entire lesson plan STRICTLY on the following textbook content:
"""
${full_text_content}
"""

CRITICAL INSTRUCTIONS:
1. Act like a real teacher planning a detailed, practical lesson. NO generic filler. Write exact teaching strategies, specific real-world examples, and precise questions you will ask.
2. Format the output EXACTLY matching the structure below. Do not add any extra headings, JSON, or markdown code blocks.
3. Fill in the bracketed areas with deep, faculty-level detail.

${school_name} 
LESSON PLAN

Name of the teacher: ${teacherName}
Designation: ${designation}
Class & Section: ${classLevel} ${section}
Subject: ${subject}
Chapter: ${finalTopic}
No. Of Periods: ${noOfPeriods}
Date of Commencement: ${dateOfCommencement}
Expected date of completion: ${expectedCompletion}
Actual date of completion: ${actualCompletion}

Learning objectives:
[Write 3-4 specific, measurable objectives using action verbs. E.g., "Students will be able to calculate...", "Students will identify..."]

Learning outcomes:
[Write 3-4 specific outcomes detailing exactly what students will demonstrate by the end of the lesson.]

Methodology:
[Provide a detailed, step-by-step teaching method. E.g., "1. Hook: Start by showing... 2. Direct Instruction: Explain the concept using [specific analogy]. 3. Guided Practice: Solve problem X together..."]

TLM:
[List specific Teaching Learning Materials. E.g., "Textbook page X, Smartboard presentation on Y, physical props like Z"]

Activities:
[Detail 1-2 specific classroom activities. E.g., "Think-Pair-Share: Students will pair up to solve...", or "Group Activity: Groups of 4 will analyze..."]

Assessment:
[List 2-3 exact questions you will ask to check understanding, or describe a specific exit ticket task.]

Home Work:
[Give a specific, actionable homework assignment related to the exact text provided.]

Sign. of the Teacher                                          Sign. of the Dean.
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
    try {
        const body = req.body || {};
        const { 
            chapterId, 
            difficulty = 'Medium', 
            questionType = 'All', 
            totalMarks = 50,
            classLevel = 'Class 8', 
            subject = 'Select',
            userInfo 
        } = body;

        if (!chapterId || chapterId === 'Select chapter first' || String(chapterId).includes('Select')) {
            return res.status(400).json({ error: "Please select a valid Class, Subject, and Chapter before generating." });
        }

        const validMarks = [10, 20, 30, 50, 70, 80, 100];
        if (!validMarks.includes(parseInt(totalMarks))) {
            return res.status(400).json({ error: "Total marks must be valid." });
        }

        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        const validatedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'Medium';

        const teacherId = userInfo?.id || 3; 

        const schoolResult = await pool.query('SELECT school_name FROM sgs_school_name LIMIT 1');
        const school_name = schoolResult.rows[0]?.school_name || '';

        const result = await pool.query(
            'SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', 
            [chapterId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Chapter not found in database" });
        }
        
        const { chapter_name, full_text_content } = result.rows[0];

        // Conditional logic to enforce the specific question type if one is requested
        const isSpecificType = questionType && questionType.toLowerCase() !== 'all';
        const typeInstruction = isSpecificType 
            ? `Generate ONLY questions of type: "${questionType}". The entire paper MUST consist exclusively of this question type. Do not divide the paper into sections.`
            : `Generate a balanced mix of objective, short answer, and long answer questions.`;

        const prompt = `
You are an expert school exam paper setter.
Create a highly accurate, classroom-ready Question Paper and Answer Key based STRICTLY on the provided textbook content.

EXAM PARAMETERS:
Chapter: "${chapter_name}"
Class: ${classLevel}
Subject: ${subject}
Difficulty: ${validatedDifficulty}
Total Marks: ${totalMarks}
Requested Format: ${questionType}

TEXTBOOK CONTENT TO USE:
"""
${full_text_content}
"""

CRITICAL INSTRUCTIONS:
1. The sum of the marks for all questions MUST add up exactly to ${totalMarks}.
2. Base all questions strictly on the provided text. Do not invent facts.
3. Complexity MUST match the ${validatedDifficulty} level.
4. ${typeInstruction}
5. You MUST return STRICTLY a JSON array of objects. Do not use markdown formatting outside the JSON block. Do not include plain text headers.

Ensure the output EXACTLY matches this schema:
[
  {
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"], // Provide an array of strings for MCQs, otherwise set to null
    "answer": "The correct answer and any marking scheme/explanation",
    "marks": Number, // e.g., 1, 2, 3, 4, 5
    "type": "${isSpecificType ? questionType : 'String (e.g., MCQ, Short Answer, Long Answer)'}"
  }
]
`;

        const aiResult = await model.generateContent(prompt);
        
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard - Auto Test", 
            `Generate AP CBSE Question Paper (${validatedDifficulty} - ${totalMarks} Marks)`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        // Strip markdown backticks and extract JSON array
        let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error("Failed to parse AI output into valid JSON array structure.");
        }

        const structuredQuestions = JSON.parse(jsonMatch[0]);

        res.json({ questionPaper: structuredQuestions });

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
    const { studentId, studentName = "Aarav", subject = "all", userInfo } = req.body;
    
    try {
        let query = `
            SELECT a.title AS test_name, a.assessment_type AS type, ar.percentage AS score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            WHERE 
        `;
        
        let params = [];
        
        if (studentId) {
            query += `s.student_id = $1`;
            params.push(studentId);
        } else {
            query += `s.full_name ILIKE $1`;
            params.push(`%${studentName}%`);
        }

        if (subject && subject !== "all") {
            query += ` AND a.subject ILIKE $2`;
            params.push(`%${subject}%`);
        }

        query += ` ORDER BY a.assessment_date DESC LIMIT 5;`;
        const dbResult = await pool.query(query, params);
        const studentData = dbResult.rows;

        // FIX: Return a static message immediately if no data exists, bypassing the AI
        if (studentData.length === 0) {
            return res.json({ 
                analysis: "• Overall Performance: No academic data found for this student.\n• Strengths: Cannot be determined.\n• Weaknesses: Cannot be determined.\n• One Recommendation: Conduct and grade an assessment to establish a performance baseline.", 
                chartData: [] 
            });
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

        // Guard against empty strings and query the correct 'subject' column
        if (subject && subject !== "all") {
            query += ` AND a.subject ILIKE $2`;
            params.push(`%${subject}%`);
        }

        query += ` GROUP BY s.full_name ORDER BY overall_score DESC;`;
        const dbResult = await pool.query(query, params);

        const classData = dbResult.rows;

        // FIX: Return a static message immediately if no data exists, bypassing the AI
        if (classData.length === 0) {
            return res.json({ 
                analysis: "• Overall class performance: No academic data found for this class.\n• Strong performers: Cannot be determined.\n• Students needing attention: Cannot be determined.\n• Teaching recommendation: Conduct and grade an assessment to establish a performance baseline.", 
                chartData: [] 
            });
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

        res.json({ analysis: aiResult.text, chartData: classData });
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
                FROM sgs_ai_chat_messages 
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
            `INSERT INTO sgs_ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, 'user', message]
        );

        const aiResult = await model.generateContent(prompt);
        const aiReply = aiResult.text;

        await logAIUsage(userInfo, "Teacher Dashboard", "Teacher AI Chatbot", aiResult.usageMetadata || aiResult.response?.usageMetadata);

        await pool.query(
            `INSERT INTO sgs_ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
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