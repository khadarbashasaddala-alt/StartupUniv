import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// For RDS, we need SSL but drizzle-kit handles it via the connection string
// Set environment variable to allow self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Exclude tables managed outside of Drizzle:
  // - "session"    → created by connect-pg-simple (express-session store)
  // - "chat_*"     → created by the Python bot (asyncpg), not Drizzle
  tablesFilter: ["!session", "!chat_leads", "!chat_sessions", "!chat_messages"],
});

