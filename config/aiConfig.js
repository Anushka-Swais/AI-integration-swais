import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Cleans AI responses before returning them.
 */
function cleanAIText(text = "") {
    return text
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .replace(/\\\(/g, "")
        .replace(/\\\)/g, "")
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/\r/g, "")
        .trim();
}

/**
 * Generates content with automatic retries.
 */
async function generateContent(prompt, maxRetries = 5) {
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL,
                contents: prompt,
            });

            return {
                ...response,
                text: cleanAIText(response.text || "")
            };

        } catch (err) {

            const status = err?.status || err?.code;

            if (
                (status === 429 ||
                 status === 500 ||
                 status === 503) &&
                attempt < maxRetries
            ) {

                console.warn(
                    `⚠️ Gemini temporary error (${status}). Retry ${attempt}/${maxRetries} in ${delay / 1000}s`
                );

                await new Promise(resolve => setTimeout(resolve, delay));

                delay *= 2;

                continue;
            }

            console.error("❌ Gemini API Error:", {
                status,
                message: err?.message,
            });

            throw err;
        }
    }
}

export default {
    generateContent,
};