import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, client files are built to dist/public
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files (CSS, JS, images, etc.) - but skip API routes
  app.use((req, res, next) => {
    // Skip API routes and health check - they should be handled by API routes
    if (req.originalUrl.startsWith("/api/") || req.originalUrl === "/health") {
      return next(); // Let API routes handle it
    }
    // For static files, use express.static
    express.static(distPath)(req, res, next);
  });

  // fall through to index.html if the file doesn't exist (SPA fallback)
  // BUT: Don't match API routes - they should be handled by API routes registered before this
  app.get("*", (req, res, next) => {
    // Skip API routes and health check - they should have been handled already
    if (req.originalUrl.startsWith("/api/") || req.originalUrl === "/health") {
      return next(); // Let Express 404 handler deal with it
    }
    
    // For all other routes, serve index.html (SPA fallback)
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
