import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";
import type { Express, Request, Response, NextFunction } from "express";

// Dedicated registry (isolated from default global — safe if prom-client is loaded twice)
export const register = new Registry();
register.setDefaultLabels({ app: "startupvarsity-portal" });

// Collect default Node.js metrics: heap, GC, event loop lag, active handles, etc.
collectDefaultMetrics({ register });

// ─── HTTP metrics ───────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsInProgress = new Gauge({
  name: "http_requests_in_progress",
  help: "HTTP requests currently being processed",
  labelNames: ["method"],
  registers: [register],
});

// ─── Database metrics ────────────────────────────────────────────────────────

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "PostgreSQL query duration in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const dbConnectionErrors = new Counter({
  name: "db_connection_errors_total",
  help: "Total database connection errors",
  registers: [register],
});

// ─── Business metrics ────────────────────────────────────────────────────────

export const userRegistrations = new Counter({
  name: "user_registrations_total",
  help: "Total user registrations",
  labelNames: ["method"], // e.g. email, sso
  registers: [register],
});

export const userLogins = new Counter({
  name: "user_logins_total",
  help: "Total user login events",
  labelNames: ["method", "status"], // status: success, failed
  registers: [register],
});

export const activeUsers = new Gauge({
  name: "active_sessions_total",
  help: "Estimated number of active user sessions",
  registers: [register],
});

export const applicationSubmissions = new Counter({
  name: "application_submissions_total",
  help: "Total program application submissions",
  labelNames: ["status"], // submitted, failed
  registers: [register],
});

export const fileUploads = new Counter({
  name: "file_uploads_total",
  help: "Total file uploads (CV, etc.)",
  labelNames: ["type", "status"],
  registers: [register],
});

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Normalize dynamic Express route paths to avoid high cardinality.
 * e.g. /api/users/abc123 → /api/users/:id
 */
function normalizeRoute(req: Request): string {
  // Use Express matched route if available (most accurate)
  if (req.route?.path) {
    const base = req.baseUrl || "";
    return base + req.route.path;
  }
  // Fallback: collapse UUIDs and numeric IDs in the raw URL
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+/g, "/:id");
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip the /metrics scrape endpoint itself
  if (req.path === "/metrics") return next();

  const start = process.hrtime.bigint();
  httpRequestsInProgress.inc({ method: req.method });

  res.on("finish", () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route = normalizeRoute(req);
    const labels = { method: req.method, route, status: String(res.statusCode) };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsInProgress.dec({ method: req.method });
  });

  next();
}

/**
 * Register the /metrics endpoint and middleware on the Express app.
 * Call this ONCE near the top of server/index.ts, before routes are registered.
 */
export function setupMetrics(app: Express) {
  // Metrics middleware — must be first so every request is measured
  app.use(metricsMiddleware);

  // Scrape endpoint — Prometheus polls this every 15s
  app.get("/metrics", async (_req: Request, res: Response) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  });
}
