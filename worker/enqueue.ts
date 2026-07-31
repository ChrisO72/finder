import type { JobsOptions } from "bullmq";
import type { JobData, JobName } from "./jobs/dispatcher";
import { defaultQueue } from "./queues";

export function enqueueJob<Name extends JobName>(
  name: Name,
  data: JobData[Name],
  options?: JobsOptions,
) {
  return defaultQueue.add(name, data, options);
}
