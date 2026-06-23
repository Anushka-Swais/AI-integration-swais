import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/db.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper Function: Logs AI Usage to the Database
const logAIUsage = async (userInfo = {}, featureUsed) => {
    const { name = 'Unknown Student', email = 'unknown@sgs.edu', role = 'Student' } = userInfo;
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
// 1. STUDENT AI CHAT (Saves to ai_chat_messages)
// ==========================================
export const handleStudentChat = async (req, res) => {
    const { message, targetLanguage = "English", userInfo } = req.body;
    const studentId = userInfo?.id || 1; 

    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        await logAIUsage(userInfo, "Student AI Tutor Chat");

        // 🔥 Save the student's message to the database
        await pool.query(
            `INSERT INTO ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [studentId, 'user', message]
        );

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `You are a supportive, encouraging AI tutor for a student. 
        INSTRUCTION ON LANGUAGE:
        1. If the student explicitly asks to explain or speak in a specific language in their message, you MUST answer entirely in the language they requested.
        2. If they do NOT specify a language in their message, answer in their default profile language: ${targetLanguage}.
        
        Do NOT generate ASCII art or text-based diagrams. 
        Student's message: "${message}"`;
        
        const aiResult = await model.generateContent(prompt);
        const aiReply = aiResult.response.text();

        // 🔥 Save the AI's reply back to the database
        await pool.query(
            `INSERT INTO ai_chat_messages (student_id, role, message_content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [studentId, 'ai', aiReply]
        );

        res.json({ reply: aiReply });
    } catch (err) {
        console.error("🚨 CHATBOT CRASH:", err);
        res.status(500).json({ error: "Failed to generate chat reply", details: err.message });
    }
};

// ==========================================
// 2. AUTO QUIZ GENERATOR
// ==========================================
export const generateAutoQuiz = async (req, res) => {
    const { chapterId, userInfo } = req.body;
    if (!chapterId) return res.status(400).json({ error: "Chapter ID is required" });

    try {
        await logAIUsage(userInfo, "Generate Practice Quiz");

        const result = await pool.query('SELECT full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter content not found in database" });
        const content = result.rows[0].full_text_content;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are an expert teacher. Read the following textbook content and generate a comprehensive multiple-choice quiz. 
            Attempt to generate 5 to 10 high-quality questions.
            You MUST return ONLY a raw JSON object. Do not add conversational text. Do not add markdown backticks.
            
            Format exactly like this:
            {
                "quiz": [
                    {
                        "question": "What is the capital of France?",
                        "options": ["London", "Paris", "Berlin", "Madrid"],
                        "answer": "Paris",
                        "explanation": "Paris is the capital and most populous city of France."
                    }
                ]
            }

            Text content to analyze: "${content}"
        `;

        const aiResult = await model.generateContent(prompt);
        let rawText = aiResult.response.text();
        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const quizData = JSON.parse(cleanedText);
        res.json(quizData);

    } catch (err) {
        console.error("🚨 QUIZ GENERATOR CRASH:", err);
        res.status(500).json({ error: "Failed to generate quiz", details: err.message });
    }
};

// ==========================================
// 3. STUDENT PERFORMANCE ANALYTICS (Reads sgs_assessment_results)
// ==========================================
export const getStudentAnalytics = async (req, res) => {
    const { userInfo } = req.body; 
    const studentId = userInfo?.id || 1; 

    try {
        await logAIUsage(userInfo, "Student Self-Assessment");

        // 🔥 Live Database Query 
        const gradesResult = await pool.query(`
            SELECT a.title AS test_name, ar.percentage AS score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id
            WHERE ar.student_id = $1 AND ar.percentage IS NOT NULL
            ORDER BY a.assessment_date ASC
            LIMIT 10;
        `, [studentId]);
        
        let grades = gradesResult.rows;

        // Fallback if the database is currently empty for this student
        if (grades.length === 0) {
            grades = [
                { test_name: "Midterm Exam", score: 75 },
                { test_name: "Algebra Quiz", score: 82 },
                { test_name: "Science Project", score: 88 }
            ];
        }
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are a supportive AI Study Coach speaking directly to a student. Analyze their test scores below. 
            Write a 2-3 sentence "Self-Assessment Report Card". Tell them how they are performing, highlight their strongest area, and gently suggest where they should focus their studying next.
            Data: ${JSON.stringify(grades)}
        `;

        const aiResult = await model.generateContent(prompt);
        res.json({ status: "success", chartData: grades, aiReportCard: aiResult.response.text() });

    } catch (err) {
        console.error("🚨 ANALYTICS CRASH:", err);
        res.status(500).json({ error: "Failed to generate analytics", details: err.message });
    }
};

// ==========================================
// 4. PACED CONTENT GENERATOR
// ==========================================
export const generatePacedContent = async (req, res) => {
    const { chapterId, pace, userInfo } = req.body;
    if (!chapterId || !pace) return res.status(400).json({ error: "Chapter ID and pace are required" });

    try {
        await logAIUsage(userInfo, `Paced Content (${pace})`);

        const result = await pool.query('SELECT full_text_content FROM sgs_chapter_content WHERE chapter_id = $1', [chapterId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });
        const content = result.rows[0].full_text_content;

        let promptModifier = "";
        if (pace === "small") promptModifier = "Summarize this into a very short, bite-sized paragraph. Keep it extremely brief.";
        else if (pace === "average") promptModifier = "Explain this clearly in 2 to 3 standard paragraphs. Make it easy to read for a normal learning pace.";
        else if (pace === "quick") promptModifier = "Create a rapid-fire, bullet-point cheat sheet of only the most crucial facts. Optimize for a fast learner who wants to skim.";

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `You are an AI Teacher. Read this textbook content: "${content}". \n\n${promptModifier} Do not use markdown backticks.`;
        
        const aiResult = await model.generateContent(prompt);
        res.json({ generatedContent: aiResult.response.text() });

    } catch (err) {
        console.error("🚨 PACED CONTENT CRASH:", err);
        res.status(500).json({ error: "Failed to generate paced content", details: err.message });
    }
};