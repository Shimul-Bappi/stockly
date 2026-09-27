import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Neon supplies a pooled runtime URL and a direct URL for schema changes.
// Local PostgreSQL may use the same DATABASE_URL for both.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before running Drizzle Kit.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
});
