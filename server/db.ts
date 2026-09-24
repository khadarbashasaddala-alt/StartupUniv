// import "dotenv/config";
import "dotenv/config";
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Lazy initialization to prevent crashes if DATABASE_URL is not immediately available
// This is especially important in ECS where secrets are injected at runtime
// and in local development where DATABASE_URL might not be set initially
let _pool: pkg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function initializePool(): pkg.Pool {
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

  // Parse connection string and configure SSL properly
  // Remove sslmode from connection string to avoid conflicts with Pool SSL config
  let connectionString = process.env.DATABASE_URL || '';
  // Remove sslmode parameter if present (we'll handle SSL via Pool config)
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');

  const connectionConfig: any = {
    connectionString: connectionString,
    max: 50, // Max pool connections (default was 10, increased for 1000+ users)
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 15000, // Increased to 15s for cloud databases (RDS, Neon, etc.)
  };

  // Always enable SSL with self-signed certificate support for cloud databases
  // This is required for AWS RDS, Neon, Supabase, etc.
  connectionConfig.ssl = {
    rejectUnauthorized: false, // Allow self-signed certificates
  };

  return new Pool(connectionConfig);
}

// Lazy getter for pool - initializes on first access
export const pool = new Proxy({} as pkg.Pool, {
  get(_target, prop) {
    if (!_pool) {
      _pool = initializePool();
    }
    const value = _pool[prop as keyof pkg.Pool];
    // Handle functions to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(_pool);
    }
    return value;
  },
});

// Lazy getter for db - initializes on first access
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (!_db) {
      if (!_pool) {
        _pool = initializePool();
      }
      _db = drizzle(_pool, { schema });
    }
    const value = _db[prop as keyof ReturnType<typeof drizzle>];
    // Handle functions to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(_db);
    }
    return value;
  },
});
