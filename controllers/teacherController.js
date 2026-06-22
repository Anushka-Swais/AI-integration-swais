import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/db.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Lesson Plan");
        
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are an expert curriculum developer. Create a highly structured, ${durationMinutes}-minute lesson plan for a teacher covering the chapter "${chapter_name}". Base the lesson plan entirely on this textbook content: "${full_text_content}". Use this exact structure: 1. **Learning Objectives** 2. **Materials Needed** 3. **Introduction** 4. **Main Activity** 5. **Conclusion & Assessment**. Format beautifully. Do not use Markdown code blocks.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ lessonPlan: aiResult.response.text() });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate lesson plan.", details: err.message });
    }
};

// 2. AUTO QUESTION PAPER GENERATOR (Now dynamically uses Total Marks!)
export const generateQuestionPaper = async (req, res) => {
    const { chapterId, difficulty = "Medium", totalMarks = 20, userInfo } = req.body;
    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Exam Paper");

        const result = await pool.query('SELECT full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const content = result.rows[0].full_text_content;
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // PROMPT UPDATED: Explicitly passes totalMarks and requires accurate calculation
        const prompt = `You are an expert exam setter. Read the following textbook content and generate a ${difficulty}-level question paper. 
        CRITICAL REQUIREMENT: The total sum of the marks for all questions MUST add up to exactly ${totalMarks} marks.
        
        You MUST return ONLY a raw JSON object. Do not add conversational text or markdown backticks. Format exactly like this: 
        { "paperTitle": "Unit Test: Chapter 1", "totalMarks": ${totalMarks}, "questions": [ { "type": "Short Answer", "question": "Explain...", "marks": 2, "rubric": "1 mark for definition, 1 mark for example." }, { "type": "Multiple Choice", "question": "Which is true?", "options": ["A", "B", "C", "D"], "answer": "B", "marks": 1 } ] } 
        Text content to analyze: "${content}"`;
        
        const aiResult = await model.generateContent(prompt);
        
        if (!aiResult.response || !aiResult.response.candidates || aiResult.response.candidates.length === 0) {
            throw new Error("AI returned an empty response. Please try again.");
        }

        const rawText = aiResult.response.text();
        
        // CRITICAL FIX: Safe Regex Extraction to prevent JSON parse crashes
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");

        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        console.error("🚨 Exam Gen Error:", err.message);
        res.status(500).json({ error: "Failed to generate question paper.", details: err.message });
    }
};

// 3. AUTO ANSWER SHEET CORRECTOR (Fixed JSON Parsing)
export const autoCorrectAnswer = async (req, res) => {
    const { question, studentAnswer, maxMarks, rubric, userInfo } = req.body;
    if (!question || !studentAnswer || !maxMarks || !rubric) return res.status(400).json({ error: "Missing required fields for grading" });

    try {
        await logAIUsage(userInfo, "Grade Sample Answer");

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are a strict but fair teacher grading a student's answer. Question: "${question}" Maximum Marks: ${maxMarks} Teacher's Grading Rubric: "${rubric}" Student's Answer: "${studentAnswer}". Analyze the student's answer against the rubric. You MUST return ONLY a raw JSON object. Do not add markdown backticks. Format exactly like this: { "awardedMarks": 1.5, "feedback": "You correctly defined the concept, but missed the second part." }`;
        
        const aiResult = await model.generateContent(prompt);
        const rawText = aiResult.response.text();

        // CRITICAL FIX: Safe Regex Extraction
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return valid JSON for grading.");

        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        res.status(500).json({ error: "Failed to correct answer.", details: err.message });
    }
};

// 4. ASSIGNMENT TRACKER WITH AUTO-REMINDERS (Fixed Content Extraction)
export const generateAssignmentReminders = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "Generate Assignment Reminders");

        const missingAssignments = [
            { student: "Aarav", subject: "Math", task: "Algebra Worksheet", due: "2 days ago" },
            { student: "Priya", subject: "Science", task: "Lab Report", due: "Yesterday" }
        ];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are a teacher's assistant. Draft a short, polite auto-reminder email to be sent to parents regarding these missing assignments: ${JSON.stringify(missingAssignments)}. Keep it under 4 sentences. Do NOT use markdown code blocks.`;
        
        const aiResult = await model.generateContent(prompt);

        if (!aiResult.response) throw new Error("Empty AI Response");

        res.json({ reminderEmail: aiResult.response.text(), list: missingAssignments });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate reminders.", details: err.message });
    }
};

// 5. SHORT, SCANNABLE STUDENT ANALYTICS
export const getSingleStudentAnalytics = async (req, res) => {
    const { studentName = "Aarav", subject = "Math", userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "View Student Analytics");

        const studentData = [
            { test_name: "Equations Quiz 1", type: "Quiz", score: 65 },
            { test_name: "Algebra Homework", type: "Assignment", score: 88 },
            { test_name: "Midterm Exam", type: "Exam", score: 68 },
            { test_name: "Group Project", type: "Project", score: 92 },
            { test_name: "Fractions Quiz", type: "Quiz", score: 72 }
        ];
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are helping a busy teacher review a student's performance. 
        Student Name: ${studentName}. Subject: ${subject}. Scores: ${JSON.stringify(studentData)}. 
        Provide EXACTLY two short bullet points:
        1. A brief summary of their trend.
        2. One quick, actionable tip for the teacher.`;
        
        const aiResult = await model.generateContent(prompt);
        if (!aiResult.response) throw new Error("Empty response from AI.");

        res.json({ analysis: aiResult.response.text(), chartData: studentData });
    } catch (err) {
        console.error("🚨 Analytics Error:", err.message);
        res.status(500).json({ error: "Failed to analyze student.", details: err.message });
    }
};

// 6. CLASS PERFORMANCE ANALYTICS
export const getClassAnalytics = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "View Class Analytics");

        const classData = [
            { student: "Aarav", math: 85, science: 92 },
            { student: "Priya", math: 45, science: 50 },
            { student: "Rohan", math: 78, science: 80 },
            { student: "Diya", math: 95, science: 88 }
        ];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Review this class data: ${JSON.stringify(classData)}. Provide a 2-sentence summary identifying the overall trend and naming any specific students who need immediate intervention. Keep it brief.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ analyticsReport: aiResult.response.text(), data: classData });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate class analytics.", details: err.message });
    }
};

// 7. LANGUAGE TRANSLATOR
export const translateText = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: "Text and target language required" });

    try {
        await logAIUsage(userInfo, "Translate Text");
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Translate the following text into ${targetLanguage}. Return ONLY the translated text, nothing else.\n\nText: "${text}"`;
        const aiResult = await model.generateContent(prompt);
        res.json({ translation: aiResult.response.text().trim() });
    } catch (err) {
        res.status(500).json({ error: "Failed to translate text.", details: err.message });
    }
};

// 8. UNIFIED TEACHER CHATBOT (Smart Language Engine)
export const teacherChatbot = async (req, res) => {
    const { message, targetLanguage = "English", userInfo } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        await logAIUsage(userInfo, "Teacher AI Chatbot");

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are a helpful AI teaching assistant. 
        INSTRUCTION ON LANGUAGE:
        1. If the teacher explicitly asks to explain, write, or speak in a specific language in their message (e.g., "in Telugu", "write an email in Hindi", etc.), you MUST answer entirely in the language they requested.
        2. If they do NOT specify a language in their message, answer in their default profile language: ${targetLanguage}.
        
        Teacher's input: "${message}"`;
        
        const aiResult = await model.generateContent(prompt);

        if (!aiResult.response || !aiResult.response.candidates || aiResult.response.candidates.length === 0) {
            throw new Error("Gemini returned an empty response. It might have triggered a safety filter.");
        }

        res.json({ reply: aiResult.response.text() });
    } catch (err) {
        console.error("🚨 Chatbot Error:", err.message);
        res.status(500).json({ error: "Chat failed.", details: err.message });
    }
};