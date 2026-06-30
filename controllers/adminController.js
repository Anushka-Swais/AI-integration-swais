import model from '../config/aiConfig.js';
import pool from "../config/db.js";


// Helper Function: Logs AI Usage to the Database
const logAIUsage = async (userInfo = {}, featureUsed) => {
    const { name = 'System Admin', email = 'admin@sgs.edu', role = 'Admin' } = userInfo;
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

// Helper Function: Cleans formatting artifacts
const cleanAIText = (text) => {
    return text
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\\(/g, "")
        .replace(/\\\)/g, "")
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
};

// ==========================================
// 1 & 2. LANGUAGE SCRIPT & AUDIO TRANSLATOR
// ==========================================
export const translateAdminText = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    
    if (!text?.trim() || !targetLanguage?.trim()) {
        return res.status(400).json({ error: "Missing text or targetLanguage parameters" });
    }

    // 🔒 SECURITY CHECK: Ensure the requested language is in your official dictionary
    if (!Object.keys(SUPPORTED_LANGUAGES).includes(targetLanguage)) {
        return res.status(400).json({ 
            error: `Language '${targetLanguage}' is not supported.`,
            supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
        });
    }

    try {
        await logAIUsage(userInfo, `Admin Translator (${targetLanguage})`);
        
        const prompt = `
You are the SGS AI Translator for the School Administrator.
Translate the following administrative text into ${targetLanguage}.

Requirements
- Return ONLY the translated text.
- Preserve names, dates, and formatting.
- Do not explain the translation.
- Do not use Markdown, HTML, or LaTeX.

Administrative Text:
"${text}"
`;

        const aiResult = await model.generateContent(prompt);
        const responseText = aiResult.text || aiResult.response.text(); 
        
        res.json({ 
            translation: cleanAIText(responseText),
            languageCode: SUPPORTED_LANGUAGES[targetLanguage] // Sends the code back to the frontend for Audio/TTS features!
        });
    } catch (err) {
        console.error("🚨 ADMIN TRANSLATOR CRASH:", err);
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};

// ==========================================
// 3. VOICE TO TEXT (Formatting & Cleanup)
// ==========================================
export const formatVoiceTranscription = async (req, res) => {
    const { rawTranscription, userInfo } = req.body;

    if (!rawTranscription?.trim()) {
        return res.status(400).json({ error: "rawTranscription is required." });
    }

    try {
        await logAIUsage(userInfo, "Admin Voice-to-Text Formatting");

        const prompt = `
You are the SGS AI Assistant for the School Administrator. 
Take the following raw, unformatted speech-to-text transcription and format it into clean, professional administrative text with proper punctuation and capitalization. 

Requirements
- Do not add new information or hallucinate facts.
- Return ONLY the cleaned and formatted text.
- Do not use Markdown, HTML, or LaTeX.

Raw Audio Text: 
"${rawTranscription}"
`;

        const aiResult = await model.generateContent(prompt);
        const formattedText = aiResult.text || aiResult.response.text();

        res.json({ formattedText: cleanAIText(formattedText) });
    } catch (err) {
        console.error("🚨 ADMIN VOICE FORMAT CRASH:", err);
        res.status(500).json({ error: "Failed to format transcription", details: err.message });
    }
};