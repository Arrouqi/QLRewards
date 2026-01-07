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

// For external database, append search_path to connection string
let finalConnectionString = connectionString;
if (isProduction && process.env.EXTERNAL_DATABASE_URL) {
  const separator = connectionString.includes('?') ? '&' : '?';
  finalConnectionString = `${connectionString}${separator}options=-c%20search_path%3Drewards_external`;
}

const pool = new Pool({
  connectionString: finalConnectionString,
  ssl: isProduction && process.env.EXTERNAL_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

export const db = drizzle(pool, { schema });
