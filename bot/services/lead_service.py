from db.connection import get_pool
from models.schemas import LeadCreate


async def create_lead(lead: LeadCreate) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO chat_leads (name, email, phone, source_page)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, phone, source_page, created_at
            """,
            lead.name,
            lead.email,
            lead.phone,
            lead.source_page,
        )
        return dict(row)


async def get_lead(lead_id: int) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, email, phone, source_page, created_at FROM chat_leads WHERE id = $1",
            lead_id,
        )
        return dict(row) if row else None
