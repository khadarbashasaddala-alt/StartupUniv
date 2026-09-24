import "dotenv/config";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import type { Socket } from "net";
import path from "path";
import fs from "fs";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initKeycloakClient } from "./services/auth-service";
import { pool } from "./db";
import { setupMetrics } from "./metrics";

const MemoryStoreSession = MemoryStore(session);
const PgStore = connectPgSimple(session);

const PORT = Number(process.env.PORT) || Number(process.env.SERVER_PORT) || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

async function startServer() {
  const app: Express = express();
  const httpServer: Server = createServer(app);

  // Trust proxy (ALB/load balancer) - important for correct IP and protocol detection
  // This ensures cookies and sessions work correctly behind AWS ALB
  app.set("trust proxy", 1);

  // Prometheus metrics — /metrics endpoint + per-request instrumentation
  setupMetrics(app);

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    })
  );

  // CSP headers to allow Chrome DevTools connection, external images, and Razorpay
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "font-src 'self' data:; " +
      "img-src 'self' data: blob: https: http:; " +
      "frame-src 'self' https://api.razorpay.com; " +
      "connect-src 'self' ws: wss: http: https: chrome-extension: https://api.razorpay.com https://checkout.razorpay.com;"
    );
    next();
  });

  // ── Chatbot microservice proxy ─────────────────────────────────────────────
  // Forwards /bot/* → http://localhost:4001/* (HTTP + WebSocket)
  const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || "http://localhost:4001";
  const botProxy = createProxyMiddleware({
    target: BOT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/bot": "" },
    ws: true,
    on: {
      error: (_err, _req, res) => {
        if (res && "writeHead" in res) {
          (res as any).writeHead(502, { "Content-Type": "application/json" });
          (res as any).end(JSON.stringify({ error: "Bot service unavailable" }));
        }
      },
    },
  });
  app.use("/bot", botProxy);
  // ────────────────────────────────────────────────────────────────────────────

  // Register CV upload route BEFORE body parser (needs raw body)
  app.post("/api/applications/cv/upload", (req, res) => {
    const uploadUrl = req.headers['x-upload-url'] as string;
    const objectKey = req.headers['x-object-key'] as string;
    const contentType = req.headers['content-type'] || 'application/pdf';
    
    if (!uploadUrl) {
      return res.status(400).json({ message: "Upload URL is required (X-Upload-URL header)" });
    }

    // Read the raw body
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const fileBuffer = Buffer.concat(chunks);
        
        if (fileBuffer.length === 0) {
          return res.status(400).json({ message: "File data is required" });
        }

        // Upload file to S3 using the signed URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          },
          body: fileBuffer,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("S3 upload error:", errorText);
          return res.status(uploadResponse.status).json({ 
            message: "Failed to upload file to S3",
            error: errorText 
          });
        }

        res.json({ 
          success: true,
          objectKey: objectKey,
          message: "File uploaded successfully"
        });
      } catch (error) {
        console.error("Error proxying CV upload:", error);
        res.status(500).json({ message: "Failed to upload file" });
      }
    });

    req.on('error', (error) => {
      console.error("Request error:", error);
      res.status(500).json({ message: "Failed to read file data" });
    });
  });

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Favicon: serve PNG for both /favicon.ico (legacy) and /favicon.png so the icon always updates
  const faviconPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(process.cwd(), "dist", "public", "favicon.png")
      : path.resolve(process.cwd(), "client", "public", "favicon.png");
  ["/favicon.ico", "/favicon.png"].forEach((route) => {
    app.get(route, (_req, res) => {
      if (fs.existsSync(faviconPath)) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=86400"); // 24h; bump ?v= in HTML to bust cache
        res.sendFile(faviconPath);
      } else {
        res.status(404).end();
      }
    });
  });

  // Health Check Route (MUST be registered FIRST, before any async operations)
  // This ensures health checks work even if database connection fails
  app.get("/health", (_req, res) => {
    // buildSha is baked into the image at build time (Dockerfile.aws ARG BUILD_SHA). The
    // deploy workflow polls this and fails if it does not match the commit it just shipped:
    // a deploy that reports success while the old container keeps serving is otherwise
    // invisible, which is exactly what happened on 6 Aug 2026 — every job green, production
    // still serving the previous bundle.
    res.status(200).json({
      status: "ok",
      buildSha: process.env.BUILD_SHA ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  });

  // Database Health Check Route
  app.get("/health/db", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const result = await pool.query("SELECT 1 as test");
      res.status(200).json({ 
        status: "ok", 
        database: "connected",
        timestamp: new Date().toISOString(),
        test: result.rows[0]
      });
    } catch (error: any) {
      console.error("❌ Database health check failed:", error);
      res.status(500).json({ 
        status: "error", 
        database: "disconnected",
        error: error.message || "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Email config check (no secrets exposed) – use to verify why emails might not send
  app.get("/health/email", (_req, res) => {
    const rawKey = (process.env.SENDGRID_API_KEY || process.env.EMAIL_HOST_PASSWORD || "").trim();
    const hasKey = rawKey.length > 0;
    const keySource = process.env.SENDGRID_API_KEY ? "SENDGRID_API_KEY" : (process.env.EMAIL_HOST_PASSWORD ? "EMAIL_HOST_PASSWORD" : "none");
    const fromAddr = process.env.EMAIL_FROM || process.env.DEFAULT_FROM_EMAIL || "noreply@startupvarsity.com";
    const keyLooksPlaceholder = rawKey === "REPLACE_ME";
    res.status(200).json({
      status: hasKey && !keyLooksPlaceholder ? "ok" : "misconfigured",
      emailConfigured: hasKey && !keyLooksPlaceholder,
      fromAddress: fromAddr,
      keySet: hasKey,
      keySource,
      keyIsPlaceholder: keyLooksPlaceholder,
      hint: !hasKey
        ? "Set SENDGRID_API_KEY or EMAIL_HOST_PASSWORD in AWS Secrets Manager and restart ECS tasks."
        : keyLooksPlaceholder
        ? "API key is still REPLACE_ME. Update startupvarsity-portal/SENDGRID_API_KEY in Secrets Manager and force new ECS deployment."
        : "Verify hello@startupvarsity.com (or domain) is verified in SendGrid.",
      timestamp: new Date().toISOString(),
    });
  });

  // Forward WebSocket upgrades for /bot/ws/* to the bot microservice
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/bot/ws/")) {
      botProxy.upgrade(req, socket as unknown as Socket, head);
    }
  });

  // Start the server IMMEDIATELY after health endpoint is registered
  // This ensures health checks can pass even if route registration fails
  // Listen on 0.0.0.0 to accept connections from health checks
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`🌐 Dev server: http://localhost:${PORT}`);
    }
  });

  // Session configuration
  // Note: In production behind ALB, we need to check if we're using HTTPS
  // Use PostgreSQL-backed session store for production (shared across ECS tasks)
  // Fallback to MemoryStore for development if DATABASE_URL is not available
  const isSecure = process.env.SESSION_SECURE === "true" || 
                   (process.env.NODE_ENV === "production" && process.env.USE_HTTPS === "true");
  
  // Use database-backed session store whenever DATABASE_URL is set (dev or production)
  // This prevents sessions from being wiped on every dev server restart
  let sessionStore: session.Store;
  const useDatabaseStore = !!process.env.DATABASE_URL;
  
  if (useDatabaseStore) {
    try {
      // Ensure database pool is initialized before creating session store
      const testPool = pool;
      
      // Verify the session table exists before creating PgStore
      // This prevents silent failures where PgStore appears to initialize
      // but then fails on every read/write because the table doesn't exist
      try {
        const tableCheck = await testPool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session') AS exists`
        );
        if (!tableCheck.rows[0]?.exists) {
          console.log("📋 Session table not found, creating it now...");
          await testPool.query(`
            CREATE TABLE IF NOT EXISTS "session" (
              "sid" VARCHAR(255) NOT NULL COLLATE "default",
              "sess" JSON NOT NULL,
              "expire" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
              PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
            )
          `);
          await testPool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
          console.log("✅ Session table created successfully");
        } else {
          console.log("✅ Session table already exists");
        }
      } catch (tableErr) {
        console.error("⚠️  Error checking/creating session table:", tableErr);
        // Continue anyway - PgStore might still work if table was created differently
      }
      
      // PostgreSQL-backed session store - persists across container restarts and is shared across all ECS tasks
      // NOTE: createTableIfMissing is NOT used because esbuild bundles the app into /app/dist/,
      // and connect-pg-simple tries to read table.sql via __dirname which resolves to /app/dist/
      // instead of node_modules/connect-pg-simple/. The session table is created above.
      sessionStore = new PgStore({
        pool: testPool,
        tableName: "session",
        createTableIfMissing: false,
        pruneSessionInterval: 60, // Prune expired sessions every 60 seconds
        errorLog: (err: Error) => {
          console.error("❌ PgStore error:", err.message);
        },
      });
      console.log("✅ Using PostgreSQL session store (persists across restarts)");
    } catch (error) {
      console.error("⚠️  Failed to initialize PostgreSQL session store, falling back to MemoryStore:", error);
      console.error("⚠️  Sessions will not persist across server restarts!");
      sessionStore = new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
    }
  } else {
    // MemoryStore fallback when no DATABASE_URL is set
    sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    console.log("✅ Using MemoryStore session store (no DATABASE_URL set)");
  }
  
  // Kept in a variable so the chat WebSocket server can reuse it to
  // authenticate the HTTP upgrade request.
  const sessionMiddleware = session({
      store: sessionStore,
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: "sv.session", // Custom session name to avoid conflicts
      cookie: {
        secure: isSecure, // Only secure if explicitly using HTTPS
        httpOnly: true, // Prevent XSS attacks - cookie not accessible via JavaScript
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year (365 days) - extended for long-lived sessions
        sameSite: "lax", // CSRF protection while allowing cross-site navigation
        // Important: Don't set domain, let browser use default
        // This ensures cookies work across subdomains and with ALB
        // Setting domain explicitly can cause issues with load balancers
      },
      rolling: true, // Extend session on every request (resets expiration timer)
      // Save session even if it wasn't modified (helps with database store)
      proxy: true, // Trust proxy (ALB) - important for correct IP and protocol detection
  });

  app.use(sessionMiddleware);

  // Initialize Keycloak SSO client (optional - only when enabled)
  if (process.env.ENABLE_SSO === "true") {
    try {
      await initKeycloakClient();
    } catch {
      console.warn("⚠️  Keycloak SSO initialization failed - SSO features will be unavailable");
      console.warn("⚠️  Regular login will continue to work normally");
      // Don't crash - SSO is optional
    }
  }

  // Register all API routes FIRST (so they take precedence over Vite's catch-all)
  try {
    await registerRoutes(httpServer, app);
    // Auto-escalation for tickets that blow past their SLA
    const { startTicketSlaWatcher } = await import("./ticketSla");
    startTicketSlaWatcher();
    // Real-time team chat. Registered before Vite so the upgrade handler for
    // our path is in place; both ignore paths they don't own.
    const { initTeamChatSocket } = await import("./chatSocket");
    initTeamChatSocket(httpServer, sessionMiddleware);
  } catch (error) {
    console.error("⚠️  Warning: Error registering routes:", error);
    console.error("⚠️  Health endpoint is still available, but some API routes may not work");
    // Don't crash - health endpoint is already registered and server is listening
  }

  // Setup Vite in development or serve static files in production
  // Vite's catch-all route must be registered AFTER API routes
  if (process.env.NODE_ENV === "production") {
    try {
      serveStatic(app);
    } catch (error) {
      console.error("⚠️  Warning: Failed to setup static file serving:", error);
      console.error("⚠️  Health endpoint is still available, but static files may not be served");
      // Don't crash - health endpoint is already registered and server is listening
    }
  } else {
    // Dynamically import vite only in development to avoid production dependency
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully...");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  // CRITICAL: Prevent unhandled promise rejections from crashing the server
  // Express 4 does NOT catch async errors automatically. If an async route handler
  // throws without try/catch, it becomes an unhandled rejection and crashes Node.js.
  process.on("unhandledRejection", (reason, promise) => {
    console.error("⚠️  Unhandled Promise Rejection (server NOT crashing):", reason);
    console.error("   Promise:", promise);
    // Do NOT call process.exit() - keep the server running
  });

  process.on("uncaughtException", (error) => {
    console.error("⚠️  Uncaught Exception (server NOT crashing):", error);
    // Do NOT call process.exit() - keep the server running
    // In production, we want the server to stay alive and let the health check determine if it's healthy
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  console.error("Error stack:", error instanceof Error ? error.stack : String(error));
  // Keep process alive for a moment to ensure logs are flushed
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

