import re
import logging
from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any

# Assuming these are imported from your Python config files
# from config.ai_config import model
# from config.db import pool

# Initialize the router and logger
router = APIRouter()
logger = logging.getLogger(__name__)

# Your Official Supported Languages Dictionary
SUPPORTED_LANGUAGES = {
    "English": "en-US", "Telugu": "te-IN", "Hindi": "hi-IN",
    "Oriya": "or-IN", "Bengali": "bn-IN", "Marathi": "mr-IN",
    "Sanskrit": "sa-IN", "Tamil": "ta-IN", "Malayalam": "ml-IN",
    "Kannada": "kn-IN", "French": "fr-FR", "Spanish": "es-ES",
    "Koya": "en-US", "Gondi": "en-US", "Konda": "en-US" 
}

# Helper Function: Logs AI Usage to the Database
async def log_ai_usage(user_info: Dict[str, Any] = None, feature_used: str = ""):
    if user_info is None:
        user_info = {}
        
    name = user_info.get('name', 'System Admin')
    email = user_info.get('email', 'admin@sgs.edu')
    role = user_info.get('role', 'Admin')
    
    try:
        # Assuming you use an async DB library like asyncpg
        await pool.execute(
            """INSERT INTO ai_usage_logs (user_name, user_email, user_type, feature_used) 
               VALUES ($1, $2, $3, $4)""",
            name, email, role, feature_used
        )
        logger.info(f"[LOG] Recorded {feature_used} usage by {name}")
    except Exception as err:
        logger.error(f"Failed to log AI usage to database: {err}")

# Helper Function: Cleans formatting artifacts using Python Regex
def clean_ai_text(text: str) -> str:
    # Replace $$, $, \(, \), \[, \]
    text = re.sub(r'\$\$?', '', text)
    text = re.sub(r'\\\(|\\\)', '', text)
    text = re.sub(r'\\\[|\\\]', '', text)
    # Replace ```json and ``` (case insensitive for json)
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    
    return text.strip()

# ==========================================
# 1 & 2. LANGUAGE SCRIPT & AUDIO TRANSLATOR
# ==========================================
@router.post("/translate")
async def translate_admin_text(request: Request):
    body = await request.json()
    text = body.get('text', '')
    target_language = body.get('targetLanguage', '')
    user_info = body.get('userInfo', {})
    
    if not text.strip() or not target_language.strip():
        # FastAPI's way of returning a 400 error
        raise HTTPException(status_code=400, detail={"error": "Missing text or targetLanguage parameters"})

    # 🔒 SECURITY CHECK: Ensure the requested language is in your official dictionary
    if target_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail={
            "error": f"Language '{target_language}' is not supported.",
            "supportedLanguages": list(SUPPORTED_LANGUAGES.keys())
        })

    try:
        await log_ai_usage(user_info, f"Admin Translator ({target_language})")
        
        prompt = f"""
You are the SGS AI Translator for the School Administrator.
Translate the following administrative text into {target_language}.

Requirements
- Return ONLY the translated text.
- Preserve names, dates, and formatting.
- Do not explain the translation.
- Do not use Markdown, HTML, or LaTeX.

Administrative Text:
"{text}"
"""
        # Using the async generate content function from google-generativeai
        ai_result = await model.generate_content_async(prompt)
        response_text = ai_result.text
        
        # FastAPI automatically converts dictionaries to JSON responses
        return {
            "translation": clean_ai_text(response_text),
            "languageCode": SUPPORTED_LANGUAGES[target_language] 
        }
    except Exception as err:
        logger.error(f"🚨 ADMIN TRANSLATOR CRASH: {err}")
        raise HTTPException(status_code=500, detail={"error": "Translation failed", "details": str(err)})

# ==========================================
# 3. VOICE TO TEXT (Formatting & Cleanup)
# ==========================================
@router.post("/format-voice")
async def format_voice_transcription(request: Request):
    body = await request.json()
    raw_transcription = body.get('rawTranscription', '')
    user_info = body.get('userInfo', {})

    if not raw_transcription.strip():
        raise HTTPException(status_code=400, detail={"error": "rawTranscription is required."})

    try:
        await log_ai_usage(user_info, "Admin Voice-to-Text Formatting")

        prompt = f"""
You are the SGS AI Assistant for the School Administrator. 
Take the following raw, unformatted speech-to-text transcription and format it into clean, professional administrative text with proper punctuation and capitalization. 

Requirements
- Do not add new information or hallucinate facts.
- Return ONLY the cleaned and formatted text.
- Do not use Markdown, HTML, or LaTeX.

Raw Audio Text: 
"{raw_transcription}"
"""

        ai_result = await model.generate_content_async(prompt)
        formatted_text = ai_result.text

        return {"formattedText": clean_ai_text(formatted_text)}
    except Exception as err:
        logger.error(f"🚨 ADMIN VOICE FORMAT CRASH: {err}")
        raise HTTPException(status_code=500, detail={"error": "Failed to format transcription", "details": str(err)})