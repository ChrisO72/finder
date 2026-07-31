import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Drizzle commands");
}

export default defineConfig({
  out: "./db/drizzle",
  schema: "./db/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
