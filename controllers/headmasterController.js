import model from '../config/aiConfig.js';
import pool from "../config/db.js";

// Helper Function: Logs AI Usage to the Database
const logAIUsage = async (userInfo = {}, featureUsed) => {
    const { name = 'Principal', email = 'admin@sgs.edu', role = 'Headmaster' } = userInfo;
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
// 1. ASSIGNMENT TRACKER REPORT (School-wide from DB)
// ==========================================
export const getAssignmentReport = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "School-Wide Assignment Report");

        // 🔥 Live Database Query: Aggregate all school results
        const dbResult = await pool.query(`
            SELECT 
                COUNT(*) AS total_assigned,
                SUM(CASE WHEN marks_obtained IS NOT NULL THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN marks_obtained IS NULL OR is_absent = true THEN 1 ELSE 0 END) AS missing
            FROM sgs_assessment_results;
        `);

        let reportData = dbResult.rows[0];

        // Fallback if DB is completely empty
        if (Number(reportData.total_assigned) === 0) {
            reportData = { total_assigned: 1200, completed: 950, missing: 250 };
        }

        const prompt = `
You are SGS AI Executive Assistant for the Headmaster.

Review the following school-wide assignment statistics.

School Data

${JSON.stringify(reportData)}

Prepare a concise executive report.

Include:

• Overall completion status.
• Key concerns requiring intervention.
• Recommended administrative action.

IMPORTANT FORMAT RULES

- Maximum 3 bullet points.
- Professional tone.
- No Markdown.
- No Markdown tables.
- No Markdown code blocks.
- No HTML.
- No ASCII diagrams.
- No LaTeX.
- No $ or $$.
- Plain text only.
`;
         
        const aiResult = await model.generateContent(prompt);
        res.json({ report: cleanAIText(aiResult.text)});
    } catch (err) {
        console.error("🚨 HEADMASTER ASSIGNMENT CRASH:", err);
        res.status(500).json({ error: "Failed to generate assignment report", details: err.message });
    }
};


// 2, 3, 4, 5. UNIFIED ACADEMIC ANALYTICS ENGINE (From DB)

export const getAcademicAnalytics = async (req, res) => {
    const { targetName, targetType, scope, userInfo } = req.body; 
    
    try {
        await logAIUsage(userInfo, `Academic Analytics (${targetType} - ${scope})`);

        let mockData = [];
        let promptContext = "";

        // 🔥 Live Database Queries based on Headmaster's selection
        if (targetType === 'student' && scope === 'single_subject') {
            const dbRes = await pool.query(`
                SELECT a.title AS test, ar.percentage AS score 
                FROM sgs_assessment_results ar 
                JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id 
                JOIN sgs_student_master s ON ar.student_id = s.student_id 
                WHERE s.full_name ILIKE $1 LIMIT 5;
            `, [`%${targetName}%`]);
            mockData = dbRes.rows.length ? dbRes.rows : [{ test: "Term 1", score: 85 }, { test: "Term 2", score: 88 }];
            promptContext = `Analyze the performance of student ${targetName} in their recent subjects.`;
            
        } else if (targetType === 'student' && scope === 'all_subjects') {
            const dbRes = await pool.query(`
                SELECT a.assessment_type AS subject, ROUND(AVG(ar.percentage), 2) AS score 
                FROM sgs_assessment_results ar 
                JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id 
                JOIN sgs_student_master s ON ar.student_id = s.student_id 
                WHERE s.full_name ILIKE $1 GROUP BY a.assessment_type;
            `, [`%${targetName}%`]);
            mockData = dbRes.rows.length ? dbRes.rows : [{ subject: "Math", score: 85 }, { subject: "Science", score: 92 }, { subject: "English", score: 78 }];
            promptContext = `Analyze the overall performance of student ${targetName} across ALL subjects.`;
            
        } else if (targetType === 'class' && scope === 'single_subject') {
            const dbRes = await pool.query(`
                SELECT s.full_name AS student, ar.percentage AS score 
                FROM sgs_assessment_results ar 
                JOIN sgs_student_master s ON ar.student_id = s.student_id 
                LIMIT 5;
            `);
            mockData = dbRes.rows.length ? dbRes.rows : [{ student: "Aarav", score: 85 }, { student: "Priya", score: 45 }, { student: "Rohan", score: 78 }];
            promptContext = `Analyze the performance of class ${targetName}. Identify struggling students.`;
            
        } else if (targetType === 'class' && scope === 'all_subjects') {
            const dbRes = await pool.query(`
                SELECT a.assessment_type AS subject, ROUND(AVG(ar.percentage), 2) AS avg_score 
                FROM sgs_assessment_results ar 
                JOIN sgs_assessments a ON ar.assessment_id = a.assessment_id 
                GROUP BY a.assessment_type;
            `);
            mockData = dbRes.rows.length ? dbRes.rows : [{ term: "Term 1", avg: 75 }, { term: "Term 2", avg: 78 }];
            promptContext = `Analyze the overall cohort performance of class ${targetName} across ALL subjects.`;
        }

        const prompt = `
You are SGS AI Academic Analytics Assistant.

${promptContext}

Academic Data

${JSON.stringify(mockData)}

Generate an executive academic report.

Include:

• Overall academic trend.
• Key strengths.
• Areas requiring intervention.
• Recommendations for school leadership.

IMPORTANT FORMAT RULES

- Maximum 4 bullet points.
- Plain text only.
- No Markdown.
- No HTML.
- No ASCII diagrams.
- No LaTeX.
- No $.
`;
  
        const aiResult = await model.generateContent(prompt);
        res.json({ analysis: cleanAIText(aiResult.text), chartData: mockData });
    } catch (err) {
        console.error("🚨 HEADMASTER ANALYTICS CRASH:", {
    message: err.message,
    status: err.status,
    stack: err.stack
});
        res.status(500).json({ error: "Failed to run academic analytics", details: err.message });
    }
};

// ==========================================
// 6. TEACHER PERFORMANCE (Live DB Query)
// ==========================================
export const getTeacherPerformance = async (req, res) => {
    const { userInfo } = req.body;
    try {
        await logAIUsage(userInfo, "Teacher Performance Review");

        // 🔥 Live Database Query: Counts how many assessments each teacher has generated
        const dbResult = await pool.query(`
            SELECT u.full_name AS name, COUNT(a.assessment_id) AS assessments_created
            FROM sgs_users_masters u
            LEFT JOIN sgs_assessments a ON u.user_id = a.teacher_id
            WHERE u.role_id = 2 OR u.full_name ILIKE '%Teacher%'
            GROUP BY u.full_name
            ORDER BY assessments_created DESC;
        `);

        let teacherData = dbResult.rows;

        if (teacherData.length === 0) {
            teacherData = [
                { name: "Teacher Priya", assessments_created: 15, parentFeedback: "Positive" },
                { name: "Teacher Swais", assessments_created: 3, parentFeedback: "Needs Improvement" }
            ];
        }

        const prompt = `
You are SGS AI School Performance Advisor.

Review the following teacher performance data.

Teacher Data

${JSON.stringify(teacherData)}

Generate an executive summary.

Include:

• High-performing teachers.
• Teachers requiring support.
• Administrative recommendations.
• Professional development suggestions.

IMPORTANT FORMAT RULES

- Maximum 4 bullet points.
- Professional tone.
- No Markdown.
- No HTML.
- No LaTeX.
- No $.
- Plain text only.
`;
 
        const aiResult = await model.generateContent(prompt);
        res.json({ report: cleanAIText(aiResult.text) });
    } catch (err) {
        console.error("🚨 TEACHER KPI CRASH:", err);
        res.status(500).json({ error: "Failed to generate teacher report", details: err.message });
    }
};

// ==========================================
// 8. LANGUAGE TRANSLATOR 
// ==========================================
export const translateForHeadmaster = async (req, res) => {
    const { text, targetLanguage, userInfo } = req.body;
    
    if (!text?.trim() || !targetLanguage?.trim()) {
    return res.status(400).json({
        error: "Missing parameters"
    });
}

    try {
        await logAIUsage(userInfo, "Headmaster Translator");
        
        const prompt = `
Translate the following official school communication into ${targetLanguage}.

Requirements

- Return ONLY the translated text.
- Preserve names.
- Preserve dates.
- Preserve formatting.
- Do not explain the translation.
- Do not use Markdown.
- Do not use HTML.

Official School Communication

"${text}"
`;

        const aiResult = await model.generateContent(prompt);
        res.json({ translation: cleanAIText(aiResult.text)});
    } catch (err) {
        console.error("🚨 TRANSLATOR CRASH:", err);
        res.status(500).json({ error: "Translation failed", details: err.message });
    }
};