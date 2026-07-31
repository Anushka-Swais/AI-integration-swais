from fastapi import APIRouter
from controllers.admin_controller import translate_admin_text, format_voice_transcription

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin AI"]
)

# FastAPI will automatically read the Pydantic models from the controller functions!
router.post("/translate")(translate_admin_text)
router.post("/format-voice")(format_voice_transcription)