import "dotenv/config";

export const redisConnection = {
  host: new URL(process.env.REDIS_URL!).hostname,
  port: parseInt(new URL(process.env.REDIS_URL!).port || "6379"),
  username: new URL(process.env.REDIS_URL!).username || undefined,
  password: new URL(process.env.REDIS_URL!).password || undefined,
  maxRetriesPerRequest: null,
};
