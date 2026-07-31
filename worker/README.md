# Worker

BullMQ processing for Finder's public Buzzsprout audio transcription and search-index pipeline.

## Structure

- `jobs/process-episode.ts` owns the `process-episode` name, payload, and handler.
- `jobs/dispatcher.ts` maps typed job names to handlers.
- `enqueue.ts` is the only producer API used by the web application.
- `queues.ts` and `redis.ts` configure the typed queue and validated Redis connection.
- `schedules/register.ts` is the registration point for future cron schedules; Finder currently
  syncs feeds manually and processes episodes on demand.
- `lib/` contains public audio download, transcription, embedding, summary, tag, and retry
  integrations.

## Episode processing

The job streams the public Buzzsprout enclosure to temporary storage, transcribes five-minute
chunks, stores resumable progress, builds rolling semantic windows, generates a summary and tags,
and then marks the episode ready. Temporary media is removed on completion or failure.

The worker intentionally keeps extended BullMQ lock and stalled-job timings because long episodes
can take several minutes. Do not replace those values with BullMQ defaults.

## Enqueueing

```ts
import { enqueueJob } from "~/worker/enqueue";
import { processEpisodeJobName } from "~/worker/jobs/process-episode";

await enqueueJob(processEpisodeJobName, { episodeId });
```

Add future jobs as focused modules and register them in `jobs/dispatcher.ts`.
