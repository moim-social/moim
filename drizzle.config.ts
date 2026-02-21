import { defineConfig } from "drizzle-kit";

const migrationDbUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationDbUrl) {
  // drizzle-kit reads this file at runtime; fail fast for misconfigured env
  throw new Error("Missing MIGRATION_DATABASE_URL or DATABASE_URL");
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDbUrl,
  },
});
