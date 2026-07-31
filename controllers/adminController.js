import model from '../config/aiConfig.js';
import pool from "../config/db.js";
import { logAIUsage } from '../utils/aiTracker.js';

// Google Cloud Voice Mapping & Supported Dictionary
const SUPPORTED_LANGUAGES = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Telugu": "te-IN",
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Oriya": "hi-IN"
};

// Helper Function: Cleans formatting artifacts
const cleanAIText = (text) => {
    if (!text) return "";
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
    
    // Check if it's a batch translation (Array) or single translation (String)
    const isBatch = Array.isArray(text);

    if (!text || !targetLanguage?.trim()) {
        return res.status(400).json({ error: "Missing text or targetLanguage parameters" });
    }

    if (!isBatch && typeof text === 'string' && !text.trim()) {
        return res.status(400).json({ error: "Text cannot be empty" });
    }

    // 🔒 SECURITY CHECK: Ensure the requested language is in your official dictionary
    if (!Object.keys(SUPPORTED_LANGUAGES).includes(targetLanguage)) {
        return res.status(400).json({ 
            error: `Language '${targetLanguage}' is not supported.`,
            supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
        });
    }

    try {
        let prompt = "";
        const usageLabel = isBatch ? `Admin Batch Translator (${targetLanguage})` : `Admin Translator (${targetLanguage})`;

        if (isBatch) {
            prompt = `
You are the SGS AI Translator for the School Administrator.
Translate the following JSON array of names, titles, or notices into ${targetLanguage}.

Requirements:
- Return ONLY a valid JSON array of strings containing the translations, in the EXACT same order.
- For names (students/teachers), transliterate them so they sound the same in ${targetLanguage}.
- Preserve dates and formatting.
- Do not explain the translation.
- Do not use Markdown outside of the JSON block.

List to translate:
${JSON.stringify(text)}
`;
        } else {
            prompt = `
You are the SGS AI Translator for the School Administrator.
Translate the following name, title, or notice into ${targetLanguage}.

Requirements:
- Return ONLY the translated text.
- If it is a person's name, transliterate it accurately so it sounds the same in ${targetLanguage}.
- Preserve dates and formatting.
- Do not explain the translation.
- Do not use Markdown, HTML, or LaTeX.

Text to translate:
"${text}"
`;
        }

        const aiResult = await model.generateContent(prompt);
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Admin Dashboard", 
            usageLabel, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        const responseText = aiResult.text || aiResult.response?.text(); 
        const cleanedText = cleanAIText(responseText);

        // Return Data Based on Input Type
        if (isBatch) {
            let translatedArray = [];
            try {
                translatedArray = JSON.parse(cleanedText);
            } catch (e) {
                // Fallback: If AI fails to return JSON, split by newlines
                translatedArray = cleanedText.split('\n').map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
            }
            return res.json({ 
                translations: translatedArray,
                languageCode: SUPPORTED_LANGUAGES[targetLanguage]
            });
        } else {
            return res.json({ 
                translation: cleanedText,
                languageCode: SUPPORTED_LANGUAGES[targetLanguage] 
            });
        }

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
        
        // ✅ NEW: Log AI Usage AFTER Gemini finishes
        await logAIUsage(
            userInfo, 
            "Admin Dashboard", 
            "Admin Voice-to-Text Formatting", 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        const formattedText = aiResult.text || aiResult.response?.text();

        res.json({ formattedText: cleanAIText(formattedText) });
    } catch (err) {
        console.error("🚨 ADMIN VOICE FORMAT CRASH:", err);
        res.status(500).json({ error: "Failed to format transcription", details: err.message });
    }
};