import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../config/db.js";

// Initialize Gemini
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
// 1. STUDENT AI CHAT (Smart Language Engine)
// ==========================================
export const handleStudentChat = async (req, res) => {
    const { message, targetLanguage = "English", userInfo } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        console.log(`[CHAT INITIATED] Student asked: "${message}" | Default Lang: ${targetLanguage}`);
        await logAIUsage(userInfo, "Student AI Tutor Chat");

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `You are a supportive, encouraging AI tutor for a student. 
        INSTRUCTION ON LANGUAGE:
        1. If the student explicitly asks to explain or speak in a specific language in their message (e.g., "explain in Telugu", "in Hindi", etc.), you MUST answer entirely in the language they requested.
        2. If they do NOT specify a language in their message, answer in their default profile language: ${targetLanguage}.
        
        Do NOT generate ASCII art or text-based diagrams. 
        Student's message: "${message}"`;
        
        const aiResult = await model.generateContent(prompt);

        if (!aiResult.response || !aiResult.response.candidates || aiResult.response.candidates.length === 0) {
            throw new Error("Gemini returned an empty response. It might have triggered a safety filter.");
        }

        res.json({ reply: aiResult.response.text() });
    } catch (err) {
        console.error("🚨 Chatbot Error:", err.message);
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
            Attempt to generate 20 questions. If the text is too short to support 20 unique questions, generate as many high-quality questions as possible.
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
        let rawText = aiResult.response.candidates[0].content.parts[0].text;
        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const quizData = JSON.parse(cleanedText);
        res.json(quizData);

    } catch (err) {
        res.status(500).json({ error: "Failed to generate quiz", details: err.message });
    }
};

// ==========================================
// 3. STUDENT PERFORMANCE ANALYTICS
// ==========================================
export const getStudentAnalytics = async (req, res) => {
    const { userInfo } = req.body; 
    const studentId = 1; 

    try {
        await logAIUsage(userInfo, "Student Self-Assessment");

        const gradesResult = await pool.query('SELECT subject, test_name, score, max_score, date_taken FROM test_results WHERE student_id = $1 ORDER BY date_taken ASC', [studentId]);
        if (gradesResult.rows.length === 0) return res.status(404).json({ error: "No grades found for this student." });
        const grades = gradesResult.rows;
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `
            You are a supportive AI Study Coach speaking directly to a student. Analyze their test scores below. 
            Write a 2-3 sentence "Self-Assessment Report Card". Tell them how they are performing across all their subjects, highlight their strongest subject, and gently suggest where they should focus their studying next.
            Data: ${JSON.stringify(grades)}
        `;

        const aiResult = await model.generateContent(prompt);
        res.json({ status: "success", chartData: grades, aiReportCard: aiResult.response.text() });

    } catch (err) {
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
        res.status(500).json({ error: "Failed to generate paced content", details: err.message });
    }
};