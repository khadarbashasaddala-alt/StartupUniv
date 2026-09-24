from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

from config import settings
from prompts.system_prompt import STARTUPVARSITY_SYSTEM_PROMPT
from agent.tools import (
    get_program_details,
    get_application_steps,
    check_eligibility,
    get_contact_info,
)

# LLM — gpt-4o-mini: fast, cost-effective, great for chatbots
llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=settings.openai_api_key,
    temperature=0.7,
    streaming=True,
)

# Tools the agent can call
TOOLS = [
    get_program_details,
    get_application_steps,
    check_eligibility,
    get_contact_info,
]

# In-memory checkpointer gives the agent multi-turn conversation memory
# Each thread_id (= session_id) gets its own isolated conversation history
_checkpointer = MemorySaver()


def build_agent():
    return create_react_agent(
        model=llm,
        tools=TOOLS,
        checkpointer=_checkpointer,
        prompt=STARTUPVARSITY_SYSTEM_PROMPT,
    )


# Singleton agent instance
agent_graph = build_agent()
