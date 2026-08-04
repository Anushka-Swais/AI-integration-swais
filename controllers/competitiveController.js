import { logAIUsage } from '../utils/aiTracker.js';
import model from '../config/aiConfig.js';
// (Make sure to include your pool import if needed elsewhere in the file)

// ==========================================
// 13. COMPETITIVE EXAM PREP MODULE (Class-Restricted)
// ==========================================
export const generateCompetitiveContent = async (req, res) => {
    // examTarget: 'NEET', 'IIT JEE', 'RRB', 'UPSC', 'Olympiad'
    const { examTarget, subject, topic, classLevel, contentType, userInfo } = req.body;
    
    if (!examTarget || !subject || !contentType || !classLevel) {
        return res.status(400).json({ error: "Exam target, subject, class level, and content type are required." });
    }

    try {
        let prompt = "";
        let isJsonExpected = false;

        const classGuardrail = `
🚨 CRITICAL AGE & SYLLABUS CONSTRAINT 🚨
The student is currently in Class ${classLevel} (Approx age: ${parseInt(classLevel) + 5} years old).
You MUST ONLY use concepts, formulas, and vocabulary strictly appropriate for a Class ${classLevel} syllabus.
Do NOT use 11th/12th-grade concepts (like integration, calculus, advanced organic chemistry) for an 8th grader.
Instead, test their Class ${classLevel} foundational knowledge, but format the questions in the tricky, analytical, and logical style of the ${examTarget} exam.
`;

        if (contentType === "PrepMaterial") {
            prompt = `
You are an expert ${examTarget} foundation faculty for Class ${classLevel}.
Generate comprehensive preparation material for the subject: ${subject}, topic: "${topic}".

${classGuardrail}

Your material must include:
1. Key Concepts & Formulas (Class ${classLevel} level only)
2. Important definitions
3. Common pitfalls or logic tricks specific to ${examTarget} pattern.

Do NOT use Markdown code blocks or LaTeX. Write math in plain text.
`;
        } else if (contentType === "MockTest" || contentType === "PracticeQuestions") {
            isJsonExpected = true;
            const questionCount = contentType === "MockTest" ? 15 : 5;
            
            prompt = `
You are an expert ${examTarget} paper setter for Class ${classLevel}.
Generate exactly ${questionCount} multiple-choice questions for ${subject} on the topic "${topic}".

${classGuardrail}

Return ONLY valid JSON. Structure exactly like this:
{
  "exam": "${examTarget}",
  "subject": "${subject}",
  "classLevel": "${classLevel}",
  "questions": [
    {
      "questionText": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "Exact text of the correct option",
      "detailedSolution": "Step-by-step explanation using ONLY Class ${classLevel} logic."
    }
  ]
}
`;
        }

        const aiResult = await model.generateContent(prompt);
        
        // ✅ NEW: Robust AI Usage Tracking for Competitive Module
        await logAIUsage(
            userInfo, 
            "Competitive Prep Module", 
            `Generate ${contentType} (${examTarget} - Class ${classLevel})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        if (isJsonExpected) {
            let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");
            return res.json(JSON.parse(jsonMatch[0]));
        } else {
            return res.json({ prepMaterial: aiResult.text });
        }

    } catch (err) {
        console.error("🚨 COMPETITIVE EXAM CRASH:", err);
        res.status(500).json({ error: "Failed to generate competitive content.", details: err.message });
    }
};