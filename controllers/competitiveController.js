import { logAIUsage } from '../utils/aiTracker.js';
import model from '../config/aiConfig.js';

// ==========================================
// 🌍 EXAM BLUEPRINT CONFIGURATION DICTIONARY
// ==========================================
// Define specific rules per class and per exam type here.
const examBlueprints = {
    "6": {
        "IIT": "Class 6 IIT Track: Focus on foundational algebra, logical reasoning, and basic physics mechanics. +4 Marks, -1 Negative Marking.",
        "NEET": "Class 6 NEET Track: Focus on introductory biology, life sciences, and basic chemistry. +4 Marks, -1 Negative Marking.",
        "CEAM": "Class 6 CEAM Programme: Standardized general competitive foundation. +4 Marks, -1 Negative Marking."
    },
    "7": {
        "IIT": "Class 7 IIT Track: Focus on quadratic equations, ratios, and conceptual physics. +4 Marks, -1 Negative Marking.",
        "NEET": "Class 7 NEET Track: Focus on detailed plant/animal biology and chemical properties. +4 Marks, -1 Negative Marking.",
        "CEAM": "Class 7 CEAM Programme: Intermediate competitive foundation."
    },
    "8": {
        "IIT": "Class 8 IIT Track: Rigorous problem-solving in Math (relations, equations) and Physics (force/energy). +4 Marks, -1 Negative Marking.",
        "NEET": "Class 8 NEET Track: In-depth Biology and introductory organic Chemistry. +4 Marks, -1 Negative Marking."
    },
    "9": {
        "IIT": "Class 9 Cream Specialized IIT Track: Heavy execution testing in JEE models (coordinate geometry, advanced physics). +4 Marks, -1 Negative Marking.",
        "NEET": "Class 9 Cream Specialized NEET Track: Advanced pre-medical foundation (meristems, taxonomy). +4 Marks, -1 Negative Marking.",
        "CEAM": "Class 9 CEAM Programme: State-level talent search prep."
    }
};

// ==========================================
// 13. COMPETITIVE EXAM PREP MODULE
// ==========================================
export const generateCompetitiveContent = async (req, res) => {
    const { 
        examTarget, // e.g., "IIT", "NEET", "CEAM"
        subject, 
        topic, 
        classLevel, 
        contentType, 
        userInfo, 
        totalMarks, 
        examDifficulty = 'Medium',
        scheduledStartTime, 
        scheduledEndTime  
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
        
        // 1. Extract the numeric class value (e.g., "Class 6" -> "6")
        const classNumStr = classLevel.replace(/\D/g, '') || "8"; 
        const classNum = parseInt(classNumStr);
        
        // 2. Look up the specific blueprint from the dictionary
        // Fallback to a generic string if the specific Class + Exam combo isn't mapped yet
        let trackInfo = "Standard Competitive Track: +4 Marks, -1 Negative Marking.";
        if (examBlueprints[classNumStr] && examBlueprints[classNumStr][examTarget]) {
            trackInfo = examBlueprints[classNumStr][examTarget];
        } else if (classNum >= 1 && classNum <= 5) {
            trackInfo = "Spark Junior Track: +2 Marks, NO Negative Marking.";
        } else if (classNum >= 11 && classNum <= 12) {
            trackInfo = "Target Elite Track: Strict national patterns (+4/-1).";
        }

        const classGuardrail = `
🚨 CRITICAL AGE, SYLLABUS & BLUEPRINT CONSTRAINT 🚨
Target Exam: ${examTarget}
Student Class: ${classLevel} (Approx age:${classNum + 5} years old)
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