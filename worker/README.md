# Worker

Background job processing with BullMQ + node-cron.

## Pattern

Jobs are typed and processed through a central handler. Cron schedules enqueue jobs to the queue.

### Defining Jobs

```typescript
// jobs.ts
export type JobData = {
  example: { message: string };
  sendEmail: { to: string; subject: string; body: string };
  syncUser: { userId: number };
};

export type JobName = keyof JobData;

export async function processJob(job: Job<JobData[JobName], void, JobName>) {
  switch (job.name) {
    case "example":
      await handleExample(job.data as JobData["example"]);
      break;
    case "sendEmail":
      await handleSendEmail(job.data as JobData["sendEmail"]);
      break;
    case "syncUser":
      await handleSyncUser(job.data as JobData["syncUser"]);
      break;
  }
}

async function handleSendEmail(data: JobData["sendEmail"]) {
  // send email logic
}

async function handleSyncUser(data: JobData["syncUser"]) {
  // sync user logic
}
```

### Scheduling Jobs

```typescript
// scheduler.ts
import cron from "node-cron";
import { defaultQueue } from "./queues";

export function startScheduler() {
  // Every hour
  cron.schedule("0 * * * *", async () => {
    await defaultQueue.add("syncUser", { userId: 123 });
  });

  // Daily at 9am
  cron.schedule("0 9 * * *", async () => {
    await defaultQueue.add("sendEmail", {
      to: "team@example.com",
      subject: "Daily Report",
      body: "...",
    });
  });
}
```

### Enqueue from App

```typescript
import { defaultQueue } from "../worker/queues";

// In a route action or loader
await defaultQueue.add("sendEmail", {
  to: user.email,
  subject: "Welcome",
  body: "Thanks for signing up!",
});
```

## Guidelines

- Add job types to `JobData` for type safety
- Keep handlers focused and minimal
- Use cron expressions: `* * * * *` (min hour day month weekday)
- Jobs auto-retry on failure (BullMQ default: 3 attempts)
