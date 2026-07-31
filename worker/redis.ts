import { env } from "~/env.server";

const redisUrl = new URL(env.REDIS_URL);

export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};
