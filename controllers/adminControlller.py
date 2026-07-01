import re
import json
from fastapi import Request
from fastapi.responses import JSONResponse

from config.ai_config import model
from config.db import pool
from config.languages import SUPPORTED_LANGUAGES


# ==========================================================
# Helper Function: Log AI Usage
# ==========================================================

async def log_ai_usage(user_info={}, feature_used=""):
    name = user_info.get("name", "System Admin")
    email = user_info.get("email", "admin@sgs.edu")
    role = user_info.get("role", "Admin")

    try:
        await pool.execute(
            """
            INSERT INTO ai_usage_logs
            (user_name, user_email, user_type, feature_used)
            VALUES ($1,$2,$3,$4)
            """,
            name, email, role, feature_used
        )
        print(f"[LOG] Recorded {feature_used} usage by {name}")
    except Exception as e:
        print("Failed to log AI usage:", e)


# ==========================================================
# Helper Function: Clean AI Output
# ==========================================================

def clean_ai_text(text: str):
    if not text:
        return ""

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

async def translate_admin_text(request: Request):
    body = await request.json()

    # 'text' can now be a single string or a list of strings (for Translate All)
    text_data = body.get("text")
    target_language = body.get("targetLanguage")
    user_info = body.get("userInfo", {})

    if not text_data or not target_language:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing text or targetLanguage parameters"}
        )

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
        
        await log_ai_usage(user_info, usage_label)

        # Handling "Translate All" (List of strings)
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
        # Handling Single Translation (String)
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

        if is_batch:
            # Parse the returned JSON array back into a Python list
            try:
                translated_texts = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback just in case the AI returns a newline-separated list instead of JSON
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
# 2. VOICE FORMATTER (For Search Bar & Dictation)
# ==========================================================

async def format_voice_transcription(request: Request):
    body = await request.json()

    raw_transcription = body.get("rawTranscription")
    user_info = body.get("userInfo", {})

    if not raw_transcription:
        return JSONResponse(
            status_code=400,
            content={"error": "rawTranscription is required."}
        )

    try:
        await log_ai_usage(user_info, "Admin Voice-to-Text Formatting")

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

        return JSONResponse({
            "formattedText": clean_ai_text(formatted_text)
        })

    except Exception as e:
        print("VOICE FORMAT ERROR:", e)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to format transcription", "details": str(e)}
        )