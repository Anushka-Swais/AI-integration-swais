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
    const teacherId = userInfo?.id || 3; 

    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Lesson Plan");
        
        const result = await pool.query('SELECT chapter_name, full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found in database" });
        
        const { chapter_name, full_text_content } = result.rows[0];
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are an expert curriculum developer. Create a highly structured, ${durationMinutes}-minute lesson plan for a teacher covering the chapter "${chapter_name}". Base the lesson plan entirely on this textbook content: "${full_text_content}". Use this exact structure: 1. **Learning Objectives** 2. **Materials Needed** 3. **Introduction** 4. **Main Activity** 5. **Conclusion & Assessment**. Format beautifully. Do not use Markdown code blocks.`;
        
        const aiResult = await model.generateContent(prompt);
        const lessonPlanText = aiResult.response.text();

        // Save the generated plan to the RDS schema
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `You are an expert exam setter. Read the following textbook content and generate a ${difficulty}-level question paper. 
        CRITICAL REQUIREMENT: The total sum of the marks for all questions MUST add up to exactly ${totalMarks} marks.
        
        You MUST return ONLY a raw JSON object. Do not add conversational text or markdown backticks. Format exactly like this: 
        { "paperTitle": "Unit Test: Chapter 1", "totalMarks": ${totalMarks}, "questions": [ { "type": "Short Answer", "question": "Explain...", "marks": 2, "rubric": "1 mark for definition, 1 mark for example." } ] } 
        Text content to analyze: "${content}"`;
        
        const aiResult = await model.generateContent(prompt);
        let rawText = aiResult.response.text();
        
        let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
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

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are a strict but fair teacher grading a student's answer. Question: "${question}" Maximum Marks: ${maxMarks} Teacher's Grading Rubric: "${rubric}" Student's Answer: "${studentAnswer}". Analyze the student's answer against the rubric. You MUST return ONLY a raw JSON object. Do not add markdown backticks. Format exactly like this: { "awardedMarks": 1.5, "feedback": "You correctly defined the concept, but missed the second part." }`;
        
        const aiResult = await model.generateContent(prompt);
        let cleanedText = aiResult.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        
        res.json(JSON.parse(jsonMatch[0]));
    } catch (err) {
        console.error("🚨 CORRECTOR CRASH:", err);
        res.status(500).json({ error: "Failed to correct answer.", details: err.message });
    }
};

// 4. ASSIGNMENT TRACKER 
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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Write a short, professional email template for a teacher to remind parents about missing assignments. Use placeholders like [Student Name]. Maximum 3 sentences. Do NOT use markdown code blocks.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ reminderEmail: aiResult.response.text(), list: missingAssignments });
    } catch (err) {
        console.error("🚨 REMINDERS CRASH:", err);
        res.status(500).json({ error: "Failed to generate reminders.", details: err.message });
    }
};

// 5. SHORT, SCANNABLE STUDENT ANALYTICS 
export const getSingleStudentAnalytics = async (req, res) => {
    const { studentName = "Aarav", userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "View Student Analytics");

        const dbResult = await pool.query(`
            SELECT a.title AS test_name, a.assessment_type AS type, ar.percentage AS score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            WHERE s.full_name ILIKE $1
            ORDER BY a.assessment_date DESC
            LIMIT 5;
        `, [`%${studentName}%`]);

        let studentData = dbResult.rows;

        if (studentData.length === 0) {
            studentData = [{ test_name: "Mock Test", type: "Exam", score: 75 }];
        }
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are helping a busy teacher review a student's performance. 
        Student Name: ${studentName}. Scores: ${JSON.stringify(studentData)}. 
        Provide EXACTLY two short bullet points:
        1. A brief summary of their trend.
        2. One quick, actionable tip for the teacher.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ analysis: aiResult.response.text(), chartData: studentData });
    } catch (err) {
        console.error("🚨 STUDENT ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to analyze student.", details: err.message });
    }
};

// 6. CLASS PERFORMANCE ANALYTICS 
export const getClassAnalytics = async (req, res) => {
    const { userInfo } = req.body;
    const teacherId = userInfo?.id || 3;

    try {
        await logAIUsage(userInfo, "View Class Analytics");

        const dbResult = await pool.query(`
            SELECT s.full_name AS student, ROUND(AVG(ar.percentage), 2) AS overall_score
            FROM sgs_assessment_results ar
            JOIN sgs_student_master s ON ar.student_id = s.student_id
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            WHERE a.teacher_id = $1
            GROUP BY s.full_name
            ORDER BY overall_score DESC;
        `, [teacherId]);

        let classData = dbResult.rows;

        if (classData.length === 0) {
            classData = [{ student: "No Data", overall_score: 0 }];
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Review this class data: ${JSON.stringify(classData)}. Provide a 2-sentence summary identifying the overall trend and naming any specific students who need immediate intervention. Keep it brief.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ analyticsReport: aiResult.response.text(), data: classData });
    } catch (err) {
        console.error("🚨 CLASS ANALYTICS CRASH:", err);
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
        console.error("🚨 TRANSLATION CRASH:", err);
        res.status(500).json({ error: "Failed to translate text.", details: err.message });
    }
};

// 8. UNIFIED TEACHER CHATBOT
export const teacherChatbot = async (req, res) => {
    const { message, targetLanguage = "English", userInfo } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        await logAIUsage(userInfo, "Teacher AI Chatbot");
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are a helpful AI teaching assistant. If the teacher explicitly asks to explain, write, or speak in a specific language in their message, you MUST answer entirely in the language they requested. If they do NOT specify a language, answer in their default profile language: ${targetLanguage}. Teacher's input: "${message}"`;
        const aiResult = await model.generateContent(prompt);
        res.json({ reply: aiResult.response.text() });
    } catch (err) {
        console.error("🚨 CHATBOT CRASH:", err);
        res.status(500).json({ error: "Chat failed.", details: err.message });
    }
};