import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use external database in production, Replit's database in development
const isProduction = process.env.NODE_ENV === "production";
const connectionString = isProduction 
  ? (process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL)
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database connection string is not set");
}

const pool = new Pool({
  connectionString,
  ssl: isProduction && process.env.EXTERNAL_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

// Set search_path to rewards_external schema for external database in production
if (isProduction && process.env.EXTERNAL_DATABASE_URL) {
  pool.on('connect', (client) => {
    client.query('SET search_path TO rewards_external');
  });
}

export const db = drizzle(pool, { schema });
