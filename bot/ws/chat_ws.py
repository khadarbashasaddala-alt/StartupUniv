import asyncio
import json
import traceback
from fastapi import WebSocket, WebSocketDisconnect
from langchain_core.messages import HumanMessage

from agent.graph import agent_graph
from services.chat_service import save_message, get_session

WELCOME_MESSAGE = (
    "Hi! I'm Vasty, your StartUpVarsity AI assistant 👋 "
    "I'm here to help you explore our programs and answer any questions. "
    "What would you like to know?"
)

FALLBACK_RESPONSE = "I'm sorry, I wasn't able to generate a response. Please try again!"

# Max seconds for the full LangGraph stream (tool call + final LLM response)
STREAM_TIMEOUT_SECONDS = 60


async def _send(ws: WebSocket, type_: str, content: str, session_id: str = "") -> None:
    await ws.send_text(json.dumps({"type": type_, "content": content, "session_id": session_id}))


def _save_bg(session_id: str, role: str, content: str) -> None:
    """Fire-and-forget DB write. DB failures never block the WebSocket loop."""
    async def _do() -> None:
        try:
            await save_message(session_id, role, content)
        except Exception:
            traceback.print_exc()
    asyncio.create_task(_do())


def _extract_token(chunk) -> str:
    """Safely extract a text token from an AIMessageChunk.

    chunk.content can be:
      - str  → returned as-is
      - list → OpenAI content-block format e.g. [{"type":"text","text":"..."}]
      - None / other → returns ""
    """
    raw = getattr(chunk, "content", None)
    if not raw:
        return ""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        return "".join(
            part.get("text", "") for part in raw if isinstance(part, dict)
        )
    return ""


async def _run_agent_stream(websocket: WebSocket, message: str, config: dict) -> str:
    """Stream the LangGraph agent response token-by-token.

    Returns the full accumulated response text. If the LLM produces zero visible
    tokens (tool-only output, empty API response, etc.) returns "".

    Raises TimeoutError if streaming exceeds STREAM_TIMEOUT_SECONDS.
    Raises any other exception thrown by the agent.
    """
    tokens: list[str] = []

    async with asyncio.timeout(STREAM_TIMEOUT_SECONDS):
        async for event in agent_graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            version="v2",
        ):
            if event["event"] != "on_chat_model_stream":
                continue
            chunk = event["data"].get("chunk")
            if chunk is None:
                continue
            token = _extract_token(chunk)
            if token:
                tokens.append(token)
                await _send(websocket, "stream", token)

    return "".join(tokens)


async def chat_websocket_handler(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    session = await get_session(session_id)
    if not session:
        await _send(websocket, "error", "Invalid session. Please refresh and try again.")
        await websocket.close()
        return

    # Greet user — save in background so welcome is instant
    await _send(websocket, "message", WELCOME_MESSAGE, session_id)
    _save_bg(session_id, "assistant", WELCOME_MESSAGE)

    # thread_id isolates each session's conversation history in LangGraph's MemorySaver
    config = {"configurable": {"thread_id": session_id}}

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            user_message = payload.get("content", "").strip()

            if not user_message:
                continue

            if len(user_message) > 2000:
                await _send(websocket, "stream", "Please keep your message under 2000 characters.")
                await _send(websocket, "end", "")
                continue

            # DB save is fire-and-forget — "typing" is sent immediately, no DB wait
            _save_bg(session_id, "user", user_message)
            await _send(websocket, "typing", "")

            # Per-request isolation: one failure never kills the WebSocket session.
            # try/finally guarantees "end" ALWAYS reaches the client — the "..."
            # placeholder can never get permanently stuck.
            try:
                response = await _run_agent_stream(websocket, user_message, config)

                # If the LLM returned zero visible tokens (e.g. empty API response,
                # tool-only cycle with no final text), send a fallback so the
                # placeholder never stays as "..." forever.
                if not response:
                    response = FALLBACK_RESPONSE
                    await _send(websocket, "stream", response)

                _save_bg(session_id, "assistant", response)

            except TimeoutError:
                traceback.print_exc()
                await _send(websocket, "stream", "Sorry, that took too long. Please try again!")
            except Exception:
                traceback.print_exc()
                await _send(websocket, "stream", "Sorry, I ran into an issue. Please try again!")
            finally:
                # Send "end" unconditionally — nothing can delay it since DB saves
                # are already background tasks.
                try:
                    await _send(websocket, "end", "")
                except Exception:
                    pass

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await _send(websocket, "error", "Connection lost. Please refresh and try again.")
        except Exception:
            pass
