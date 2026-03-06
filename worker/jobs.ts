import { Job } from "bullmq";

export type JobData = {
  example: { message: string };
};

export type JobName = keyof JobData;

export async function processJob(job: Job<JobData[JobName], void, JobName>) {
  console.log(`[Worker] Processing ${job.name}`, job.data);

  switch (job.name) {
    case "example":
      await handleExample(job.data as JobData["example"]);
      break;
  }
}

async function handleExample(data: JobData["example"]) {
  console.log(`[Worker] Example job: ${data.message}`);
}

