import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.{test,spec}.ts", "shared/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    // The server suite boots an in-process Postgres (PGlite) and does real DB work, which does not
    // fit vitest's 5s default on CI hardware. Set here rather than passed as a CLI flag so every
    // entry point gets it — `npm test`, `npm run test:backend`, and a bare `npx vitest` alike.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});

