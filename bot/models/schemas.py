from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    source_page: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    source_page: Optional[str] = None
    created_at: datetime


class SessionCreate(BaseModel):
    lead_id: int


class SessionResponse(BaseModel):
    session_id: str
    lead_id: int
    status: str
    created_at: datetime


class WSIncoming(BaseModel):
    content: str


class WSOutgoing(BaseModel):
    type: str   # "message" | "typing" | "stream" | "end" | "error"
    content: str
    session_id: Optional[str] = None
