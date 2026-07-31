# Worker

BullMQ processing for Finder's YouTube transcription and search-index pipeline.

## Structure

- `jobs/process-video.ts` owns the stable `process-video` name, payload, and handler.
- `jobs/dispatcher.ts` maps typed job names to handlers.
- `enqueue.ts` is the only producer API used by the web application.
- `queues.ts` and `redis.ts` configure the typed queue and validated Redis connection.
- `schedules/register.ts` is the registration point for future cron schedules; Finder currently
  processes videos only on demand.
- `lib/` contains YouTube download, transcription, embedding, summary, tag, and retry integrations.

## Video processing

The job fetches metadata, downloads audio, transcribes five-minute chunks, stores resumable progress,
builds rolling semantic windows, generates a summary and tags, and then marks the video ready.
Temporary media is removed on completion or failure.

The worker intentionally keeps extended BullMQ lock and stalled-job timings because long videos can
take several minutes. Do not replace those values with BullMQ defaults.

## Enqueueing

```ts
import { enqueueJob } from "~/worker/enqueue";
import { processVideoJobName } from "~/worker/jobs/process-video";

await enqueueJob(processVideoJobName, { videoId });
```

Keep the `process-video` queue name stable so jobs already waiting in Redis remain dispatchable.
Add future jobs as focused modules and register them in `jobs/dispatcher.ts`.
