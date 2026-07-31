// utils/aiTracker.js
import pool from "../config/db.js"; // Adjust this path if your db.js is located somewhere else

export const logAIUsage = async (userInfo = {}, moduleName, featureName, usageMetadata = {}) => {
    // 1. Get User Email and Name safely
    const email = userInfo.email || 'unknown@user.com';
    const name = userInfo.name || 'System User';
    
    // 2. Fixed Client Name (Defaults to SGS if not set in .env)
    const clientName = process.env.CLIENT_NAME || 'SGS'; 

    // 3. Extract Tokens safely from Gemini's response object
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const completionTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

    // 4. Generate exact IST Time & Date
    const istTime = new Date().toLocaleString("en-US", { 
        timeZone: "Asia/Kolkata",
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    try {
        await pool.query(
            `INSERT INTO ai_usage_logs 
            (client_name, user_email, module_name, feature_used, prompt_tokens, completion_tokens, total_tokens, created_at_ist) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [clientName, email, moduleName, featureName, promptTokens, completionTokens, totalTokens, istTime]
        );
        console.log(`[LOG] ${clientName} - ${moduleName} -> ${featureName} used by ${email} | Tokens: ${totalTokens}`);
    } catch (err) {
        console.error("🚨 Failed to log AI usage to database:", err.message);
    }
};