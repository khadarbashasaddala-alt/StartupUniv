import logging
from fastapi import APIRouter, HTTPException
from models.schemas import LeadCreate, LeadResponse
from services.lead_service import create_lead, get_lead

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("", response_model=LeadResponse, status_code=201)
async def create_new_lead(lead: LeadCreate):
    try:
        result = await create_lead(lead)
        return result
    except Exception as e:
        # Log detailed error server-side
        logger.error(f"Error creating lead: {e}", exc_info=True)
        # Return generic message to client (no internal details)
        raise HTTPException(
            status_code=500,
            detail="Failed to create lead. Please try again later."
        )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead_by_id(lead_id: int):
    lead = await get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead
