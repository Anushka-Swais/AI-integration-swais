from fastapi import APIRouter
from pydantic import BaseModel
from typing import Union, List, Optional
from controllers.admin_controller import (
    translate_admin_text,
    format_voice_transcription
)

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin AI"]
)

# ==========================================
# Pydantic Schemas (For Auto-Documentation)
# ==========================================

class TranslateRequest(BaseModel):
    # Accepts either a single string or a list of strings
    text: Union[str, List[str]] 
    targetLanguage: str
    userInfo: Optional[dict] = {}

class VoiceFormatRequest(BaseModel):
    rawTranscription: str
    userInfo: Optional[dict] = {}

# ==========================================
# Routes
# ==========================================

# Notice we changed it to accept the Pydantic models instead of just `Request`
# (You would also need to update the controller to accept these models instead of `Request`)

# If you are keeping `request: Request` in your controller, you can just keep your 
# current route code:
router.post("/translate")(translate_admin_text)
router.post("/format-voice")(format_voice_transcription)