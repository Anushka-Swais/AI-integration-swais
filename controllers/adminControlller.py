import re

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
            name,
            email,
            role,
            feature_used
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

    text = body.get("text")
    target_language = body.get("targetLanguage")
    user_info = body.get("userInfo", {})

    if not text or not target_language:

        return JSONResponse(
            status_code=400,
            content={
                "error": "Missing text or targetLanguage parameters"
            }
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

        await log_ai_usage(
            user_info,
            f"Admin Translator ({target_language})"
        )

        prompt = f"""
You are the SGS AI Translator for the School Administrator.

Translate the following administrative text into {target_language}.

Requirements

- Return ONLY the translated text.
- Preserve names, dates and formatting.
- Do not explain the translation.
- Do not use Markdown.
- Do not use HTML.
- Do not use LaTeX.

Administrative Text

"{text}"
"""

        ai_result = await model.generate_content(prompt)

        response_text = ai_result.text

        return JSONResponse({

            "translation": clean_ai_text(response_text),

            "languageCode":
            SUPPORTED_LANGUAGES[target_language]

        })

    except Exception as e:

        print("ADMIN TRANSLATOR ERROR:", e)

        return JSONResponse(
            status_code=500,
            content={
                "error": "Translation failed",
                "details": str(e)
            }
        )


# ==========================================================
# 2. VOICE FORMATTER
# ==========================================================

async def format_voice_transcription(request: Request):

    body = await request.json()

    raw_transcription = body.get("rawTranscription")
    user_info = body.get("userInfo", {})

    if not raw_transcription:

        return JSONResponse(
            status_code=400,
            content={
                "error": "rawTranscription is required."
            }
        )

    try:

        await log_ai_usage(
            user_info,
            "Admin Voice-to-Text Formatting"
        )

        prompt = f"""
You are the SGS AI Assistant for the School Administrator.

Take the following raw speech-to-text transcription
and convert it into professional administrative text.

Requirements

- Do not hallucinate.
- Keep the meaning unchanged.
- Add punctuation.
- Add capitalization.
- Return ONLY the formatted text.
- Do not use Markdown.
- Do not use HTML.
- Do not use LaTeX.

Raw Audio Text

"{raw_transcription}"
"""

        ai_result = await model.generate_content(prompt)

        formatted_text = ai_result.text

        return JSONResponse({

            "formattedText":
            clean_ai_text(formatted_text)

        })

    except Exception as e:

        print("VOICE FORMAT ERROR:", e)

        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to format transcription",
                "details": str(e)
            }
        )