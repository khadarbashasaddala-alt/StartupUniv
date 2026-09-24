import uuid
from db.connection import get_pool


async def create_session(lead_id: int) -> dict:
    session_id = str(uuid.uuid4())
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO chat_sessions (id, lead_id)
            VALUES ($1, $2)
            RETURNING id, lead_id, status, created_at
            """,
            session_id,
            lead_id,
        )
        return dict(row)


async def get_session(session_id: str) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, lead_id, status, created_at FROM chat_sessions WHERE id = $1",
            session_id,
        )
        return dict(row) if row else None


async def save_message(session_id: str, role: str, content: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO chat_messages (session_id, role, content)
            VALUES ($1, $2, $3)
            """,
            session_id,
            role,
            content,
        )


async def get_session_messages(session_id: str) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, session_id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
            session_id,
        )
        return [dict(r) for r in rows]
