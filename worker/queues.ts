import { Queue } from "bullmq";
import type { JobData, JobName } from "./jobs/dispatcher";
import { redisConnection } from "./redis";

export const defaultQueue = new Queue<JobData[JobName], void, JobName>("default", {
  connection: redisConnection,
});
