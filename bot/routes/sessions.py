import logging
from fastapi import APIRouter, HTTPException
from models.schemas import SessionCreate, SessionResponse
from services.chat_service import create_session, get_session, get_session_messages

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", status_code=201)
async def create_new_session(data: SessionCreate):
    try:
        result = await create_session(data.lead_id)
        return {
            "session_id": result["id"],
            "lead_id": result["lead_id"],
            "status": result["status"],
            "created_at": result["created_at"],
        }
    except Exception as e:
        # Log detailed error server-side
        logger.error(f"Error creating session: {e}", exc_info=True)
        # Return generic message to client (no internal details)
        raise HTTPException(
            status_code=500,
            detail="Failed to create session. Please try again later."
        )


@router.get("/{session_id}")
async def get_session_with_messages(session_id: str):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await get_session_messages(session_id)
    return {**session, "messages": messages}
