import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const globalForDb = globalThis as typeof globalThis & {
  __stocklyPostgresPool?: Pool;
};

export const pool = globalForDb.__stocklyPostgresPool ?? new Pool({
  connectionString: databaseUrl,
  max: process.env.VERCEL === "1" ? 3 : 10,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});

// Vercel Fluid Compute closes idle connections before the function is suspended.
if (process.env.VERCEL === "1") attachDatabasePool(pool);
if (process.env.NODE_ENV !== "production") globalForDb.__stocklyPostgresPool = pool;

export const db = drizzle(pool);
