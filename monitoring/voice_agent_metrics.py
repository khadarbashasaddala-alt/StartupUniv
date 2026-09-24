"""
Prometheus Metrics for Voice Agent
===================================
Drop this file into backend-voice-agent/ and run the metrics server:

    from voice_agent_metrics import start_metrics_server, ACTIVE_CALLS, CALL_DURATION
    start_metrics_server(port=9091)

    # In your call handling code:
    ACTIVE_CALLS.inc()            # when call starts
    ACTIVE_CALLS.dec()            # when call ends
    CALL_DURATION.observe(120.5)  # call lasted 120.5 seconds

Install: pip install prometheus-client
"""

import logging
from prometheus_client import (
    Counter, Histogram, Gauge, Info,
    start_http_server,
)

logger = logging.getLogger(__name__)

# =============================================================================
# VOICE AGENT METRICS
# =============================================================================

# Call metrics
ACTIVE_CALLS = Gauge(
    "voice_active_calls",
    "Number of currently active voice calls"
)

TOTAL_CALLS = Counter(
    "voice_calls_total",
    "Total voice calls",
    ["status", "agent_type"]  # status: completed, failed, dropped, transferred
)

CALL_DURATION = Histogram(
    "voice_call_duration_seconds",
    "Duration of voice calls",
    buckets=[5, 15, 30, 60, 120, 300, 600, 1200, 1800]
)

# Agent performance
AGENT_TRANSFERS = Counter(
    "voice_agent_transfers_total",
    "Total agent-to-agent transfers",
    ["from_agent", "to_agent"]
)

# STT/TTS metrics
STT_LATENCY = Histogram(
    "voice_stt_latency_seconds",
    "Speech-to-text processing latency",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

TTS_LATENCY = Histogram(
    "voice_tts_latency_seconds",
    "Text-to-speech processing latency",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

LLM_LATENCY = Histogram(
    "voice_llm_latency_seconds",
    "LLM response generation latency",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

# Error tracking
ERRORS = Counter(
    "voice_errors_total",
    "Total errors in voice agent",
    ["error_type"]  # stt_error, tts_error, llm_error, sip_error, connection_error
)

# LiveKit connection
LIVEKIT_CONNECTED = Gauge(
    "voice_livekit_connected",
    "Whether voice agent is connected to LiveKit (1=yes, 0=no)"
)

VOICE_AGENT_INFO = Info(
    "voice_agent",
    "Voice agent info"
)


# =============================================================================
# METRICS SERVER
# =============================================================================

def start_metrics_server(port=9091):
    """Start a standalone Prometheus metrics HTTP server on the given port."""
    start_http_server(port)
    VOICE_AGENT_INFO.info({
        "name": "crm-voiceagent-voice",
        "version": "1.0.0",
    })
    logger.info(f"Voice agent Prometheus metrics server started on port {port}")
