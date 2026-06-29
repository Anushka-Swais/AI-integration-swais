import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// ================================
// Validate Environment Variables
// ================================
if (!process.env.GEMINI_API_KEY) {
    throw new Error("❌ GEMINI_API_KEY is missing in .env");
}

if (!process.env.GEMINI_MODEL) {
    throw new Error("❌ GEMINI_MODEL is missing in .env");
}

// ================================
// Initialize Gemini
// ================================
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// ================================
// Clean AI Response
// ================================
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

// ================================
// Generate Content
// ================================
async function generateContent(prompt, maxRetries = 5) {

    // Validate prompt
    if (!prompt || typeof prompt !== "string") {
        throw new Error("Prompt is missing or invalid.");
    }

    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {

            console.log("================================");
            console.log("Gemini Request");
            console.log("Model :", process.env.GEMINI_MODEL);
            console.log("Prompt Length :", prompt.length);
            console.log("API Key Exists :", !!process.env.GEMINI_API_KEY);
            console.log("================================");

            const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL,
                contents: prompt,
            });

            const text =
                response.text ||
                response.candidates?.[0]?.content?.parts
                    ?.map(part => part.text)
                    .join("") ||
                "";

            return {
                ...response,
                text: cleanAIText(text),
            };

        } catch (err) {

            console.error("================================");
            console.error("Gemini API Error");
            console.error("Status :", err?.status);
            console.error("Code :", err?.code);
            console.error("Message :", err?.message);
            console.error("================================");

            const status = err?.status || err?.code;

            if (
                [429, 500, 503].includes(status) &&
                attempt < maxRetries
            ) {

                console.warn(
                    `Retry ${attempt}/${maxRetries} after ${delay / 1000}s`
                );

                await new Promise(resolve => setTimeout(resolve, delay));

                delay *= 2;

                continue;
            }

            throw err;
        }
    }
}

export default {
    generateContent,
};