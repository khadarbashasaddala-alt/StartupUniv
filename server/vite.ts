import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import reactPlugin from "@vitejs/plugin-react";
import express from "express";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  // Serve static files from public directory BEFORE Vite middleware
  // This ensures images and other static assets are accessible
  const publicDir = path.resolve(process.cwd(), "client", "public");
  if (fs.existsSync(publicDir)) {
    console.log(`📁 Serving static files from: ${publicDir}`);
    // Create static middleware once
    const staticMiddleware = express.static(publicDir, {
      // Don't serve index.html as a static file - let Vite handle it
      index: false,
    });
    
    // Register static file serving middleware with route filtering
    app.use((req, res, next) => {
      // Skip API routes and health check - they should be handled by API routes
      if (req.originalUrl.startsWith("/api") || req.originalUrl === "/health") {
        return next();
      }
      // Serve static files from public directory
      staticMiddleware(req, res, next);
    });
  } else {
    console.warn(`⚠️  Public directory not found: ${publicDir}`);
  }

  const vite = await createViteServer({
    configFile: false,
    root: "client",
    publicDir: "public",
    plugins: [reactPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "client", "src"),
        "@shared": path.resolve(process.cwd(), "shared"),
        "@assets": path.resolve(process.cwd(), "attached_assets"),
      },
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Use Vite middleware for static assets, HMR, and module requests
  app.use(vite.middlewares);

  // Catch-all route for frontend SPA - handles all HTML page requests
  // This ensures /, /login, /app, and all other client routes work correctly
  app.get("*", async (req, res, next) => {
    // Skip for API routes and health check
    if (req.originalUrl.startsWith("/api") || req.originalUrl === "/health" || req.originalUrl.startsWith("/vite-hmr")) {
      return next();
    }

    // Skip if this is a static file request (should have been handled by Vite or static middleware)
    if (req.originalUrl.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/)) {
      return next();
    }

    // Skip Vite internal routes
    if (req.originalUrl.startsWith("/@") || req.originalUrl.startsWith("/node_modules")) {
      return next();
    }

    // Don't override if response was already sent successfully by Vite
    if (res.headersSent && res.statusCode === 200) {
      return;
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        process.cwd() || ".",
        "client",
        "index.html",
      );

      // Check if file exists
      if (!fs.existsSync(clientTemplate)) {
        console.error(`❌ index.html not found at: ${clientTemplate}`);
        return res.status(404).send("index.html not found");
      }

      // Read and transform index.html through Vite
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      // Transform the HTML through Vite (this injects Vite client and HMR)
      const page = await vite.transformIndexHtml(url, template);
      
      // Send the response
      if (!res.headersSent) {
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
      }
    } catch (e) {
      // If Vite transformation fails, serve raw index.html as fallback
      if (!res.headersSent) {
        try {
          const clientTemplate = path.resolve(
            process.cwd() || ".",
            "client",
            "index.html",
          );
          if (fs.existsSync(clientTemplate)) {
            const template = await fs.promises.readFile(clientTemplate, "utf-8");
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
          } else {
            console.error(`❌ index.html not found at: ${clientTemplate}`);
            res.status(404).send("index.html not found");
          }
        } catch (fallbackError) {
          console.error("❌ Error serving index.html:", fallbackError);
      vite.ssrFixStacktrace(e as Error);
      next(e);
        }
      }
    }
  });
}
