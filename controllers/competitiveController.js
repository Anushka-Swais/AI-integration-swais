import { logAIUsage } from '../utils/aiTracker.js';
import model from '../config/aiConfig.js';
// Import your database models here (e.g., Mongoose models or SQL pool)
// import Exam from '../models/Exam.js'; 

// ==========================================
// 13. COMPETITIVE EXAM PREP MODULE (Class-Restricted & Standardized)
// ==========================================
export const generateCompetitiveContent = async (req, res) => {
    // examTarget: 'NEET', 'IIT JEE' , 'UPSC', 'Olympiad'
    // totalMarks: 20, 30, 50, 70, 100
    // examDifficulty: 'Easy', 'Medium', 'Hard'
    const { 
        examTarget, 
        subject, 
        topic, 
        classLevel, 
        contentType, 
        userInfo, 
        totalMarks, 
        examDifficulty = 'Medium',
        scheduledDate // Added to schedule the exam for the whole class
    } = req.body;
    
    if (!examTarget || !subject || !contentType || !classLevel) {
        return res.status(400).json({ error: "Exam target, subject, class level, and content type are required." });
    }

    // Validate marks for Quiz/MockTests
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

        const classGuardrail = `
🚨 CRITICAL AGE, SYLLABUS & DIFFICULTY CONSTRAINT 🚨
The student is currently in Class ${classLevel} (Approx age: ${parseInt(classLevel) + 5} years old).
You MUST ONLY use concepts, formulas, and vocabulary strictly appropriate for a Class ${classLevel} syllabus based on standard micro-schedules.
Do NOT use advanced 11th/12th-grade concepts for lower classes.
Difficulty Level Assigned by Faculty: ${examDifficulty}. Ensure the complexity of the questions strictly matches this difficulty.
`;

        if (contentType === "PrepMaterial") {
            prompt = `
You are an expert ${examTarget} foundation faculty for Class ${classLevel}.
Generate comprehensive preparation material and dashboard notes for the subject: ${subject}, topic: "${topic}".

${classGuardrail}

Your material must include:
1. Key Concepts & Formulas (Class ${classLevel} level only)
2. Important definitions
3. Common pitfalls or logic tricks specific to the ${examTarget} pattern.
4. A brief encouraging note for the student dashboard.

Do NOT use Markdown code blocks or LaTeX. Write math in plain text.
`;
        } else if (contentType === "MockTest" || contentType === "PracticeQuestions" || contentType === "Quiz") {
            isJsonExpected = true;
            
            prompt = `
You are an expert ${examTarget} paper setter generating a STANDARDIZED assessment. This EXACT paper will be taken by all Class ${classLevel} students.
Generate EXACTLY ${questionCount} multiple-choice questions for ${subject} on the topic "${topic}".
Each question carries 1 mark. Total Marks: ${questionCount}.

${classGuardrail}

🚨 CRITICAL INSTRUCTION: Return ONLY valid JSON. 
Do NOT include markdown formatting. Do NOT use \`\`\`json. 
Do NOT write any conversational text, warnings, or notes before or after the JSON.

Return EXACTLY this structure:
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
            `Generate Standardized ${contentType} (${examTarget} - Class ${classLevel})`, 
            aiResult.usageMetadata || aiResult.response?.usageMetadata
        );

        if (isJsonExpected) {
            let cleanedText = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI did not return a valid JSON format.");
            
            const examData = JSON.parse(jsonMatch[0]);

            // 🚨 NEW LOGIC: Save the standardized exam to your database here 🚨
            // Example pseudo-code:
            /*
            const newExam = await Exam.create({
                assignedBy: userInfo.userId,
                classLevel: classLevel,
                scheduledDate: scheduledDate,
                examContent: examData
            });
            return res.json({ message: "Exam successfully scheduled for all students!", examId: newExam._id });
            */

            // For now, returning the generated JSON so your frontend can preview it before saving
            return res.json({
                message: "Preview generated successfully. Save this to the database to assign it to the class.",
                previewData: examData
            });

        } else {
            // Save prep material to database similar to the exam logic
            return res.json({ prepMaterial: aiResult.text });
        }

    } catch (err) {
        console.error("🚨 COMPETITIVE EXAM CRASH:", err);
        res.status(500).json({ error: "Failed to generate competitive content.", details: err.message });
    }
};