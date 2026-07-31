import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  REFRESH_SECRET: z.string().min(32, "REFRESH_SECRET must be at least 32 characters"),
  LETTERMINT_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  APP_URL: z.url(),
  MISTRAL_API_KEY: z.string().min(1),
  WEBSHARE_PROXY_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url().optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  throw new Error("Invalid environment variables. See errors above.");
}

export const env = parsed.data;
