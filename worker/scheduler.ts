import cron from "node-cron";
import { defaultQueue } from "./queues";

export function startScheduler() {
  // Every minute - example job
  cron.schedule("* * * * *", async () => {
    await defaultQueue.add("example", { message: "scheduled ping" });
  });

  console.log("[Scheduler] Cron jobs registered");
}

