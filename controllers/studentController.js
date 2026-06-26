import model from '../config/aiConfig.js';
import pool from "../config/db.js";

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

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        await logAIUsage(userInfo, "Student AI Tutor Chat");

        // Save student's message
        await pool.query(
            `INSERT INTO ai_chat_messages
            (student_id, role, message_content, created_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [studentId, "user", message]
        );

        const prompt = `
You are SGS AI, a supportive, encouraging AI tutor for school students.

INSTRUCTION ON LANGUAGE:
1. If the student explicitly asks to explain or speak in a specific language, answer entirely in that language.
2. Otherwise, answer in the student's default profile language: ${targetLanguage}.

RESPONSE RULES:
1. Explain concepts step by step.
2. Use simple language suitable for school students.
3. Encourage learning without giving unnecessary praise.
4. If solving mathematics, show each calculation clearly.
5. Write all mathematical expressions in plain text.
6. NEVER use LaTeX.
7. NEVER use Markdown math.
8. NEVER wrap equations in $...$ or $$...$$.
9. NEVER use \\( \\) or \\[ \\].
10. Never generate ASCII art or text diagrams.
11. Never use HTML.
12. Keep formatting clean and readable.

Examples:

Correct:
2 × 3 = 6

Wrong:
$2 \\times 3 = 6$

Student's message:
"${message}"
`;

        const aiResult = await model.generateContent(prompt);
        const aiReply = aiResult.text;

        // Save AI reply
        await pool.query(
            `INSERT INTO ai_chat_messages
            (student_id, role, message_content, created_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [studentId, "ai", aiReply]
        );

        res.json({
            reply: aiReply,
        });

    } catch (err) {
        console.error("🚨 CHATBOT CRASH:", err);

        res.status(500).json({
            error: "Failed to generate chat reply",
            details: err.message,
        });
    }
};

// ==========================================
// 2. AUTO QUIZ GENERATOR
// ==========================================
export const generateAutoQuiz = async (req, res) => {

    const { chapterId, userInfo } = req.body;

    if (!chapterId) {
        return res.status(400).json({
            error: "Chapter ID is required",
        });
    }

    try {

        await logAIUsage(userInfo, "Generate Practice Quiz");

        const result = await pool.query(
            `SELECT full_text_content
             FROM sgs_chapter_content
             WHERE chapter_id = $1`,
            [chapterId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Chapter content not found in database",
            });
        }

        const content = result.rows[0].full_text_content;

        const prompt = `
You are an expert school teacher.

Read the following chapter and generate a high-quality multiple-choice quiz.

Rules:
- Generate 5–10 questions.
- Questions should test understanding, not memorization only.
- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT return backticks.
- Do NOT return explanations outside JSON.
- Do NOT use LaTeX.
- Do NOT use $ or $$.

JSON format:

{
  "quiz": [
    {
      "question": "...",
      "options": ["A","B","C","D"],
      "answer": "...",
      "explanation": "..."
    }
  ]
}

Chapter:

"${content}"
`;

        const aiResult = await model.generateContent(prompt);

        let rawText = aiResult.text;

        const cleanedText = rawText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const quizData = JSON.parse(cleanedText);

        res.json(quizData);

    } catch (err) {

        console.error("🚨 QUIZ GENERATOR CRASH:", err);

        res.status(500).json({
            error: "Failed to generate quiz",
            details: err.message,
        });
    }
};

// ==========================================
// 3. STUDENT PERFORMANCE ANALYTICS
// ==========================================
export const getStudentAnalytics = async (req, res) => {

    const { userInfo } = req.body;

    const studentId = userInfo?.id || 1;

    try {

        await logAIUsage(userInfo, "Student Self-Assessment");

        const gradesResult = await pool.query(
            `
            SELECT
                a.title AS test_name,
                ar.percentage AS score
            FROM sgs_assessment_results ar
            JOIN sgs_assessments a
                ON ar.assessment_id = a.assessment_id
            WHERE ar.student_id = $1
            AND ar.percentage IS NOT NULL
            ORDER BY a.assessment_date ASC
            LIMIT 10;
            `,
            [studentId]
        );

        let grades = gradesResult.rows;

        if (grades.length === 0) {

            grades = [
                {
                    test_name: "Midterm Exam",
                    score: 75,
                },
                {
                    test_name: "Algebra Quiz",
                    score: 82,
                },
                {
                    test_name: "Science Project",
                    score: 88,
                },
            ];
        }

        const prompt = `
You are an encouraging AI Study Coach.

Analyze the student's academic performance.

Write a report in 2–3 short paragraphs.

Include:
- Overall performance
- Strongest subject
- Areas needing improvement
- One practical study suggestion

Formatting rules:
- No markdown
- No HTML
- No LaTeX
- No $ symbols
- Plain text only

Student data:

${JSON.stringify(grades)}
`;

        const aiResult = await model.generateContent(prompt);

        res.json({
            status: "success",
            chartData: grades,
            aiReportCard: aiResult.text,
        });

    } catch (err) {

        console.error("🚨 ANALYTICS CRASH:", err);

        res.status(500).json({
            error: "Failed to generate analytics",
            details: err.message,
        });
    }
};

// ==========================================
// 4. PACED CONTENT GENERATOR
// ==========================================
export const generatePacedContent = async (req, res) => {

    const { chapterId, pace, userInfo } = req.body;

    if (!chapterId || !pace) {
        return res.status(400).json({
            error: "Chapter ID and pace are required",
        });
    }

    try {

        await logAIUsage(userInfo, `Paced Content (${pace})`);

        const result = await pool.query(
            `SELECT full_text_content
             FROM sgs_chapter_content
             WHERE chapter_id = $1`,
            [chapterId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Chapter not found",
            });
        }

        const content = result.rows[0].full_text_content;

        let promptModifier = "";

        if (pace === "small") {
            promptModifier =
                "Summarize this into a very short, bite-sized paragraph. Keep it extremely brief.";
        } else if (pace === "average") {
            promptModifier =
                "Explain this clearly in 2 to 3 standard paragraphs. Make it easy to read for a normal learning pace.";
        } else if (pace === "quick") {
            promptModifier =
                "Create a rapid-fire, bullet-point cheat sheet of only the most crucial facts. Optimize for a fast learner who wants to skim.";
        }

        const prompt = `
You are an experienced school teacher.

Read the following chapter.

"${content}"

Task:
${promptModifier}

Formatting rules:
- Plain text only.
- Do NOT use markdown.
- Do NOT use backticks.
- Do NOT use LaTeX.
- Do NOT use $ symbols.
- Do NOT use HTML.
- If mathematics is included, write equations in plain text.

Example:

Correct:
15 + 20 = 35

Wrong:
$15 + 20 = 35$
`;

        const aiResult = await model.generateContent(prompt);

        res.json({
            generatedContent: aiResult.text,
        });

    } catch (err) {

        console.error("🚨 PACED CONTENT CRASH:", err);

        res.status(500).json({
            error: "Failed to generate paced content",
            details: err.message,
        });
    }
};