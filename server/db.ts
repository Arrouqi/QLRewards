import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database connection string is not set. Please set EXTERNAL_DATABASE_URL or DATABASE_URL.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.EXTERNAL_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 30000,
});

// Set search_path to rewards_external schema for external database
if (process.env.EXTERNAL_DATABASE_URL) {
  pool.on('connect', (client) => {
    client.query('SET search_path TO rewards_external');
  });
}

export const db = drizzle(pool, { schema });
