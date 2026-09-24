CREATE_CHAT_TABLES = """
CREATE TABLE IF NOT EXISTS chat_leads (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(50),
    source_page VARCHAR(500),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id         VARCHAR(100) PRIMARY KEY,
    lead_id    INTEGER REFERENCES chat_leads(id) ON DELETE CASCADE,
    status     VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         SERIAL PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_lead_id  ON chat_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session  ON chat_messages(session_id);
"""


async def run_migrations(pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute(CREATE_CHAT_TABLES)
    print("✅ Chat DB tables ready")
