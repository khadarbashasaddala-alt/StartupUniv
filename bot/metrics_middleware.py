"""
Prometheus Metrics Middleware for FastAPI (backend-api)
======================================================
Drop this file into backend-api/ and import in api_server.py:

    from metrics_middleware import setup_metrics
    setup_metrics(app)

Exposes /metrics endpoint for Prometheus to scrape.
Install: pip install prometheus-client prometheus-fastapi-instrumentator
"""

import time
import logging
from prometheus_client import (
    Counter, Histogram, Gauge, Info,
    generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry, REGISTRY,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# =============================================================================
# METRICS DEFINITIONS
# =============================================================================

# Request metrics
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method"]
)

# Application-specific metrics
ACTIVE_CALLS = Gauge(
    "voice_agent_active_calls",
    "Number of active voice calls"
)

TOTAL_CALLS = Counter(
    "voice_agent_calls_total",
    "Total voice calls processed",
    ["status"]  # completed, failed, dropped
)

CALL_DURATION = Histogram(
    "voice_agent_call_duration_seconds",
    "Duration of voice calls in seconds",
    buckets=[10, 30, 60, 120, 300, 600, 1200]
)

LEADS_CREATED = Counter(
    "leads_created_total",
    "Total leads created",
    ["source"]
)

CAMPAIGNS_ACTIVE = Gauge(
    "campaigns_active",
    "Number of active campaigns"
)

DB_QUERY_DURATION = Histogram(
    "db_query_duration_seconds",
    "Database query duration in seconds",
    ["query_type"],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

APP_INFO = Info(
    "app",
    "Application info"
)


# =============================================================================
# MIDDLEWARE
# =============================================================================

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to track request count, duration, and in-progress requests."""

    async def dispatch(self, request: Request, call_next):
        # Skip metrics endpoint itself
        if request.url.path == "/metrics":
            return await call_next(request)

        method = request.method
        # Normalize path to avoid high cardinality
        path = self._normalize_path(request.url.path)

        REQUESTS_IN_PROGRESS.labels(method=method).inc()
        start_time = time.time()

        try:
            response = await call_next(request)
            status = str(response.status_code)
        except Exception:
            status = "500"
            raise
        finally:
            duration = time.time() - start_time
            REQUEST_COUNT.labels(method=method, endpoint=path, status=status).inc()
            REQUEST_DURATION.labels(method=method, endpoint=path).observe(duration)
            REQUESTS_IN_PROGRESS.labels(method=method).dec()

        return response

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Replace dynamic path segments to prevent cardinality explosion."""
        parts = path.strip("/").split("/")
        normalized = []
        for i, part in enumerate(parts):
            # Replace UUIDs and numeric IDs
            if len(part) > 20 or (part.isdigit() and len(part) > 2):
                normalized.append("{id}")
            else:
                normalized.append(part)
        return "/" + "/".join(normalized) if normalized else "/"


# =============================================================================
# SETUP FUNCTION
# =============================================================================

def setup_metrics(app):
    """
    Add Prometheus metrics to a FastAPI app.
    Call this once in your api_server.py:

        from metrics_middleware import setup_metrics
        setup_metrics(app)
    """
    # Add middleware
    app.add_middleware(PrometheusMiddleware)

    # Add /metrics endpoint
    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(
            content=generate_latest(REGISTRY),
            media_type=CONTENT_TYPE_LATEST
        )

    # Set app info
    APP_INFO.info({
        "name": "crm-voiceagent-api",
        "version": "1.0.0",
    })

    logger.info("Prometheus metrics enabled at /metrics")
