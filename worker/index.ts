import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { processJob } from "./jobs";
import { startScheduler } from "./scheduler";

const worker = new Worker("default", processJob, {
  connection: redisConnection,
  lockDuration: 600_000,
  lockRenewTime: 60_000,
  stalledInterval: 600_000,
});

startScheduler();

console.log("[Worker] Ready");

async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received, shutting down...`);
  await worker.close();
  console.log("[Worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
