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
// 1. AUTO LESSON PLANNER (HIGH-DETAIL CLASSROOM-READY ENGINE)
// ==========================================
export const generateLessonPlan = async (req, res) => {
    const { 
        chapterId, 
        durationMinutes = 45, 
        userInfo,
        classLevel = 'Class 8',
        subject = 'Social Studies',
        topic,
        subtopic,
        teacherInstructions = 'None'
    } = req.body;

    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        const result = await pool.query(
            'SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', 
            [chapterId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Chapter not found in database" });
        }
        
        const { chapter_name, full_text_content } = result.rows[0];
        const finalTopic = topic && topic.trim() !== '' ? topic : chapter_name;

        const prompt = `
You are a Master Educator and Senior Curriculum Specialist.
Create an exhaustive, highly detailed, step-by-step classroom lesson plan for:

Class/Grade: ${classLevel}
Subject: ${subject}
Chapter: ${chapter_name}
Topic: ${finalTopic} ${subtopic ? `(Subtopic: ${subtopic})` : ''}
Duration: ${durationMinutes} Minutes
Special Teacher Directives: ${teacherInstructions}

TEXTBOOK CONTENT TO USE (Strict Basis):
"""
${full_text_content}
"""

CRITICAL INSTRUCTIONS FOR MAXIMUM DETAIL & QUALITY:
1. Avoid vague summaries (e.g., NEVER say "Explain key concepts to students"). Write the actual explanation, the exact questions the teacher should ask, and the expected answers from students.
2. Ensure the time breakdown across all stages sums exactly to ${durationMinutes} minutes.
3. Clean Formatting Rule: Do NOT use markdown bolding like '**word**' or '*' asterisks inside sentences. Use plain, clean headings and clear bullet points (•) so the text displays cleanly in modern UI cards.

STRUCTURE TO GENERATE:

===================================================================
LESSON PLAN: ${finalTopic}
===================================================================

1. LESSON METADATA
• Grade / Class: ${classLevel}
• Subject: ${subject}
• Topic: ${finalTopic}
• Duration: ${durationMinutes} Minutes
• Central Idea: (2-3 detailed sentences explaining the core takeaway)
• Essential Question: (One deep inquiry question to spark curiosity)

2. LEARNING OBJECTIVES (Bloom's Taxonomy Aligned)
By the end of this ${durationMinutes}-minute lesson, students will be able to:
• [Objective 1 - Recall/Knowledge]
• [Objective 2 - Understanding/Explanation]
• [Objective 3 - Application/Analysis]
• [Objective 4 - Higher Order Thinking / Synthesis]

3. MATERIALS & CLASSROOM AIDS REQUIRED
• Standard Aids: Textbook, Blackboard/Smartboard, Colored Chalk/Markers
• Specialized Aids: (List relevant maps, diagrams, realia, or slide decks needed)
• Non-Digital Backup: (Practical alternative if digital tools fail)

4. SET INDUCTION & PRIOR KNOWLEDGE ACTIVATION (Estimated: 5-8 Mins)
• Hook Activity: (A compelling story, real-world scenario, or thought-provoking puzzle)
• Diagnostic Questions to Ask Class:
  1. Question: [Specific question] | Expected Answer: [Answer]
  2. Question: [Specific question] | Expected Answer: [Answer]
• Teacher Transition Statement: (Exact phrasing the teacher uses to introduce today's topic)

5. STEP-BY-STEP TEACHING & LEARNING FLOW (${durationMinutes} MINUTE TIMELINE)
Divide the lesson into logical phases (e.g., Hook, Direct Instruction, Guided Activity, Formative Check, Closure).

Format for each phase:
---
Phase: [Phase Name] | Time: [X] Mins
- Teacher Action & Script: (Give the detailed explanation and real-world examples to teach)
- Student Action: (What students are actively writing, discussing, or solving)
- Pedagogical Method: (Direct Instruction / Inquiry / Think-Pair-Share / Interactive Discussion)
- In-Class Check for Understanding: (Quick question or observation check during this stage)
---

6. KEY CONCEPTS, DEFINITIONS & BOARD SUMMARY
Provide what the teacher should write on the blackboard for visual reinforcement:
• Core Term 1: Definition and student-friendly explanation
• Core Term 2: Definition and student-friendly explanation
• Key Concept Summary / Flow Diagram (in structured text)
• Common Misconception & Correction: (State common student error and the exact remedy)

7. INTERACTIVE ACTIVITY / APPLICATION TASK
• Activity Name:
• Grouping: (Individual / Pairs / Groups of 4)
• Task Description: (Concrete step-by-step activity instructions for students)
• Expected Output: (What students produce by the end of the activity)

8. DIFFERENTIATED INSTRUCTION STRATEGY
• For Support / Remedial Learners: (Scaffolding strategy, simplified cue, or targeted prompt)
• For Grade-Level Learners: (Core expected practice task)
• For Advanced Learners: (High-Order Thinking extension challenge or open inquiry)

9. FORMATIVE ASSESSMENT & QUICK CHECKS
• Question 1 (Conceptual): [Question with model answer]
• Question 2 (Analytical/Application): [Question with model answer]
• Question 3 (Case/Scenario-Based): [Question with model answer]

10. LESSON CLOSURE & EXIT TICKET (Estimated: 5 Mins)
• 3 Key Takeaways to Summarize
• Exit Ticket Prompt: (1 rapid written question for students to submit before leaving)
• Bridge to Next Lesson: (What topic comes next and how this lesson connects to it)

11. HOMEWORK & INDEPENDENT PRACTICE
• Core Practice Task: (Review and textbook consolidation)
• Application / Mini-Research Task: (Real-world or analytical assignment)
• Estimated Completion Time: (e.g., 20 minutes)
`;

        const aiResult = await model.generateContent(prompt);
        const lessonPlanText = aiResult.text;

        // Log AI Usage
        await logAIUsage(
            userInfo, 
            "Teacher Dashboard", 
            "Generate Lesson Plan", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        // Save record to DB
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