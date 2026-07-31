import re
import json
import os
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Union, List, Optional

from config.ai_config import model
from config.db import pool
from config.languages import SUPPORTED_LANGUAGES

# ==========================================================
# Pydantic Schemas (For Auto-Validation & Swagger UI)
# ==========================================================
class TranslateRequest(BaseModel):
    text: Union[str, List[str]] 
    targetLanguage: str
    userInfo: Optional[dict] = {}

class VoiceFormatRequest(BaseModel):
    rawTranscription: str
    userInfo: Optional[dict] = {}

# ==========================================================
# Helper Function: Log AI Usage & Tokens
# ==========================================================
async def log_ai_usage(user_info, module_name, feature_name, usage_metadata=None):
    email = user_info.get("email", "admin@sgs.edu") if user_info else "admin@sgs.edu"
    client_name = os.getenv("CLIENT_NAME", "SGS")
    
    prompt_tokens = getattr(usage_metadata, "prompt_token_count", 0) if usage_metadata else 0
    completion_tokens = getattr(usage_metadata, "candidates_token_count", 0) if usage_metadata else 0
    total_tokens = getattr(usage_metadata, "total_token_count", 0) if usage_metadata else (prompt_tokens + completion_tokens)
    
    ist = timezone(timedelta(hours=5, minutes=30))
    ist_time = datetime.now(ist).strftime('%Y-%m-%d %H:%M:%S')

    try:
        await pool.execute(
            """
            INSERT INTO ai_usage_logs
            (client_name, user_email, module_name, feature_used, prompt_tokens, completion_tokens, total_tokens, created_at_ist)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            client_name, email, module_name, feature_name, prompt_tokens, completion_tokens, total_tokens, ist_time
        )
        print(f"[LOG] {client_name} - {module_name} -> {feature_name} used by {email} | Tokens: {total_tokens}")
    except Exception as e:
        print("🚨 Failed to log AI usage to database:", e)


# ==========================================================
# Helper Function: Clean AI Output
# ==========================================================
def clean_ai_text(text: str):
    if not text: return ""
    text = re.sub(r"\$\$", "", text)
    text = re.sub(r"\$", "", text)
    text = re.sub(r"\\\(", "", text)
    text = re.sub(r"\\\)", "", text)
    text = re.sub(r"\\\[", "", text)
    text = re.sub(r"\\\]", "", text)
    text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)
    return text.strip()


# ==========================================================
# 1. ADMIN TRANSLATOR
# ==========================================================
async def translate_admin_text(payload: TranslateRequest):
    # Data is automatically extracted and validated by Pydantic!
    text_data = payload.text
    target_language = payload.targetLanguage
    user_info = payload.userInfo

    # Validate language
    if target_language not in SUPPORTED_LANGUAGES:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Language '{target_language}' is not supported.",
                "supportedLanguages": list(SUPPORTED_LANGUAGES.keys())
            }
        )

    try:
        is_batch = isinstance(text_data, list)
        usage_label = f"Admin Batch Translator ({target_language})" if is_batch else f"Admin Translator ({target_language})"

        if is_batch:
            prompt = f"""
You are the SGS AI Translator for the School Administrator.
Translate the following JSON array of names, titles, or notices into {target_language}.
Requirements:
- Return ONLY a valid JSON array of strings containing the translations, in the EXACT same order.
- For names (students/teachers), transliterate them so they sound the same in {target_language}.
- Preserve dates and formatting.
- Do not explain the translation.
- Do not use Markdown outside of the JSON block.

List to translate:
{json.dumps(text_data)}
"""
        else:
            prompt = f"""
You are the SGS AI Translator for the School Administrator.
Translate the following name, title, or notice into {target_language}.
Requirements:
- Return ONLY the translated text.
- If it is a person's name, transliterate it accurately so it sounds the same in {target_language}.
- Preserve dates and formatting.
- Do not explain the translation.
- Do not use Markdown, HTML, or LaTeX.

Text to translate:
"{text_data}"
"""

        ai_result = await model.generate_content(prompt)
        response_text = clean_ai_text(ai_result.text)

        await log_ai_usage(
            user_info, 
            "Admin Dashboard", 
            usage_label, 
            getattr(ai_result, "usage_metadata", None)
        )

        if is_batch:
            try:
                translated_texts = json.loads(response_text)
            except json.JSONDecodeError:
                translated_texts = [line.strip("- *") for line in response_text.split('\n') if line.strip()]

            return JSONResponse({
                "translations": translated_texts,
                "languageCode": SUPPORTED_LANGUAGES[target_language]
            })
        else:
            return JSONResponse({
                "translation": response_text,
                "languageCode": SUPPORTED_LANGUAGES[target_language]
            })

    except Exception as e:
        print("ADMIN TRANSLATOR ERROR:", e)
        return JSONResponse(
            status_code=500,
            content={"error": "Translation failed", "details": str(e)}
        )


# ==========================================================
# 2. VOICE FORMATTER 
# ==========================================================
async def format_voice_transcription(payload: VoiceFormatRequest):
    # Data is automatically extracted and validated by Pydantic!
    raw_transcription = payload.rawTranscription
    user_info = payload.userInfo

    try:
        prompt = f"""
You are the SGS AI Assistant for the School Administrator.
Take the following raw speech-to-text transcription and convert it into accurate text.
Note: This could be a short search query (like a student's name) or administrative dictation.

Requirements:
- Do not hallucinate.
- Keep the meaning unchanged.
- Fix any obvious speech recognition errors (e.g., phonetic spelling of Indian names).
- Add punctuation and capitalization ONLY if it is a full sentence. If it looks like a short search query or name, just capitalize appropriately.
- Return ONLY the formatted text.
- Do not use Markdown, HTML, or LaTeX.

Raw Audio Text:
"{raw_transcription}"
"""

        ai_result = await model.generate_content(prompt)
        formatted_text = ai_result.text

        await log_ai_usage(
            user_info, 
            "Admin Dashboard", 
            "Admin Voice-to-Text Formatting", 
            getattr(ai_result, "usage_metadata", None)
        )

        return JSONResponse({
            "formattedText": clean_ai_text(formatted_text)
        })

    except Exception as e:
        print("VOICE FORMAT ERROR:", e)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to format transcription", "details": str(e)}
        )