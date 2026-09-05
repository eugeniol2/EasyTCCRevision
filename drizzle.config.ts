import { readFileSync } from "node:fs";
import type { Config } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  readFileSync(".env.local", "utf8").match(/DATABASE_URL="([^"]+)"/)?.[1];

if (!url) throw new Error("DATABASE_URL não encontrada");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
