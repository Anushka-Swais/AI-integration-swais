import { logAIUsage } from '../utils/aiTracker.js';
import model from '../config/aiConfig.js';
// import Exam from '../models/Exam.js'; 

// ==========================================
// 13. COMPETITIVE EXAM PREP MODULE (Time-Scheduled)
// ==========================================
export const generateCompetitiveContent = async (req, res) => {
    const { 
        examTarget, 
        subject, 
        topic, 
        classLevel, 
        contentType, 
        userInfo, 
        totalMarks, 
        examDifficulty = 'Medium',
        scheduledStartTime, // e.g., "2026-09-01T10:00:00Z"
        scheduledEndTime    // e.g., "2026-09-01T13:00:00Z"
    } = req.body;
    
    if (!examTarget || !subject || !contentType || !classLevel) {
        return res.status(400).json({ error: "Exam target, subject, class level, and content type are required." });
    }

    const validMarks = [20, 30, 50, 70, 100];
    let questionCount = 0;

    if (contentType !== "PrepMaterial") {
        if (!totalMarks || !validMarks.includes(parseInt(totalMarks))) {
            return res.status(400).json({ error: "For exams, totalMarks must be exactly 20, 30, 50, 70, or 100." });
        }
        questionCount = parseInt(totalMarks);
    }

    try {
        let prompt = "";
        let isJsonExpected = false;
        
        let trackInfo = "";
        const classNum = parseInt(classLevel.replace(/\D/g, '')) || 8; 

        if (classNum >= 1 && classNum <= 5) {
            trackInfo = "Spark Junior Track: +2 Marks, NO Negative Marking.";
        } else if (classNum >= 6 && classNum <= 8) {
            trackInfo = "Pre-Foundation Spark / CEAM: +4 Marks, -1 Negative Marking.";
        } else if (classNum >= 9 && classNum <= 10) {
            trackInfo = "Cream Specialized Track: Heavy execution testing. +4 Marks, -1 Negative Marking.";
        } else if (classNum >= 11 && classNum <= 12) {
            trackInfo = "Target Elite Track: Strict national patterns (+4/-1).";
        }

        const classGuardrail = `
🚨 CRITICAL AGE, SYLLABUS & AP CBSE BLUEPRINT CONSTRAINT 🚨
Target Exam: ${examTarget}
Student Class: ${classLevel} (Approx age: ${classNum + 5} years old)
Institutional Track Guidelines: ${trackInfo}

You MUST ONLY use concepts strictly appropriate for a Class ${classLevel} syllabus, adhering to the SGS Eduhunt micro-schedules. 
Difficulty Level: ${examDifficulty}.
`;

        if (contentType === "PrepMaterial") {
            prompt = `
You are an expert ${examTarget} faculty. Generate preparation material for Class ${classLevel}, Subject: ${subject}, Topic: "${topic}".
${classGuardrail}
1. Key Concepts
2. Important definitions
3. Common pitfalls
`;
        } else {
            isJsonExpected = true;
            prompt = `
You are an expert ${examTarget} paper setter.
Generate EXACTLY ${questionCount} multiple-choice questions for ${subject} on "${topic}". Each question is 1 mark.

${classGuardrail}

🚨 Return ONLY valid JSON matching this exact structure. Do NOT use markdown code blocks (\`\`\`json).
{
  "exam": "${examTarget}",
  "subject": "${subject}",
  "topic": "${topic}",
  "classLevel": "${classLevel}",
  "difficulty": "${examDifficulty}",
  "totalMarks": ${questionCount},
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "Exact text of the correct option",
      "marks": 1,
      "difficulty": "${examDifficulty}",
      "detailedSolution": "Step-by-step explanation using ONLY Class ${classLevel} logic."
    }
  ]
}
`;
        }

        const aiResult = await model.generateContent(prompt);
        
        await logAIUsage(
            userInfo, 
            "Competitive Prep Module", 
            `Generate Standardized ${contentType}`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        if (isJsonExpected) {
            let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");
            
            const examData = JSON.parse(jsonMatch[0]);

            return res.json({
                message: "Preview generated successfully.",
                scheduleData: {
                    startTime: scheduledStartTime || "Not set",
                    endTime: scheduledEndTime || "Not set"
                },
                previewData: examData
            });

        } else {
            return res.json({ prepMaterial: aiResult.text });
        }

    } catch (err) {
        console.error("🚨 COMPETITIVE EXAM CRASH:", err);
        res.status(500).json({ error: "Failed to generate competitive content.", details: err.message });
    }
};