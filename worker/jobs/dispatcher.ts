import type { Job } from "bullmq";
import {
  handleProcessVideoJob,
  type ProcessVideoJobData,
  processVideoJobName,
} from "./process-video";

export type JobData = {
  [processVideoJobName]: ProcessVideoJobData;
};

export type JobName = keyof JobData;

type TypedJob = {
  [Name in JobName]: Job<JobData[Name], void, Name>;
}[JobName];

export async function processJob(job: Job<JobData[JobName], void, JobName>) {
  console.log(`[Worker] Processing ${job.name}`, job.data);

  const typedJob = job as TypedJob;
  switch (typedJob.name) {
    case processVideoJobName:
      await handleProcessVideoJob(typedJob.data);
      break;
    default:
      throw new Error(`[Worker] Unknown job name: ${job.name}`);
  }
}
