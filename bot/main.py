from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.connection import get_pool, close_pool
from db.migrations import run_migrations
from routes.leads import router as leads_router
from routes.sessions import router as sessions_router
from routes.health import router as health_router
from ws.chat_ws import chat_websocket_handler
from metrics_middleware import setup_metrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        pool = await get_pool()
        await run_migrations(pool)
        print(f"✅ Database connected successfully")
    except Exception as e:
        print(f"⚠️  Database unavailable at startup: {e}")
        print(f"⚠️  Bot will start anyway — DB-dependent routes will fail until DB is reachable")
    print(f"🤖 StartUpVarsity Bot running on port {settings.bot_port}")
    yield
    await close_pool()


app = FastAPI(
    title="StartUpVarsity Chatbot",
    description="LangGraph-powered AI chatbot microservice for StartUpVarsity",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads_router)
app.include_router(sessions_router)
app.include_router(health_router)
setup_metrics(app)


@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await chat_websocket_handler(websocket, session_id)
