import { Job } from "bullmq";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  fetchVideoMetadata,
  downloadAudio,
  extractChunk,
} from "./lib/youtube";
import { transcribeChunk } from "./lib/transcribe";
import { getVideoById, updateVideo } from "../db/repositories/videos";
import {
  bulkInsertSegments,
  updateSegmentEmbeddings,
} from "../db/repositories/segments";
import { embedTexts } from "./lib/embed";

export type JobData = {
  "process-video": { videoId: number };
};

export type JobName = keyof JobData;

const CHUNK_SECONDS = 300; // 5 minutes

export async function processJob(job: Job<JobData[JobName], void, JobName>) {
  console.log(`[Worker] Processing ${job.name}`, job.data);

  switch (job.name) {
    case "process-video":
      await handleProcessVideo(job.data as JobData["process-video"]);
      break;
  }
}

async function handleProcessVideo(data: JobData["process-video"]) {
  const { videoId } = data;
  const video = await getVideoById(videoId);
  if (!video) {
    console.error(`[Worker] Video ${videoId} not found`);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), "finder", String(videoId));
  await mkdir(tmpDir, { recursive: true });

  const audioPath = path.join(tmpDir, `${video.youtubeVideoId}.m4a`);

  try {
    await updateVideo(videoId, { status: "processing" });

    // Step 1: Fetch metadata (skip if already populated — resuming)
    if (!video.title) {
      console.log(`[Worker] Fetching metadata for ${video.youtubeUrl}`);
      const meta = await fetchVideoMetadata(video.youtubeUrl);
      await updateVideo(videoId, {
        title: meta.title,
        channelTitle: meta.channelTitle,
        thumbnailUrl: meta.thumbnailUrl,
        durationSeconds: meta.durationSeconds,
        publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
      });
      video.title = meta.title;
      video.durationSeconds = meta.durationSeconds;
    }

    const duration = video.durationSeconds ?? 0;
    if (duration <= 0) {
      throw new Error("Could not determine video duration");
    }

    // Step 2: Download full audio (skip if file already exists — resuming)
    if (!existsSync(audioPath)) {
      console.log(`[Worker] Downloading audio to ${audioPath}`);
      await downloadAudio(video.youtubeUrl, audioPath);
    }

    // Step 3: Process in 5-minute chunks
    const freshVideo = await getVideoById(videoId);
    const processedSeconds = freshVideo?.processedSeconds ?? 0;

    const chunks: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < duration; start += CHUNK_SECONDS) {
      const end = Math.min(start + CHUNK_SECONDS, duration);
      chunks.push({ start, end });
    }

    for (const chunk of chunks) {
      if (chunk.end <= processedSeconds) {
        console.log(
          `[Worker] Skipping chunk ${chunk.start}-${chunk.end}s (already processed)`,
        );
        continue;
      }

      const chunkPath = path.join(
        tmpDir,
        `chunk_${chunk.start}_${chunk.end}.m4a`,
      );

      console.log(`[Worker] Extracting chunk ${chunk.start}-${chunk.end}s`);
      await extractChunk(audioPath, chunkPath, chunk.start, chunk.end);

      console.log(`[Worker] Transcribing chunk ${chunk.start}-${chunk.end}s`);
      const transcriptSegments = await transcribeChunk(chunkPath, chunk.start);

      if (transcriptSegments.length > 0) {
        const inserted = await bulkInsertSegments(
          transcriptSegments.map((seg) => ({
            videoId,
            text: seg.text,
            startSeconds: seg.startSeconds,
            endSeconds: seg.endSeconds,
          })),
        );

        console.log(`[Worker] Embedding ${inserted.length} segments`);
        const embeddings = await embedTexts(inserted.map((s) => s.text));
        await updateSegmentEmbeddings(
          inserted.map((s, i) => ({ id: s.id, embedding: embeddings[i] })),
        );
      }

      await updateVideo(videoId, { processedSeconds: chunk.end });
      console.log(`[Worker] Chunk complete — processedSeconds = ${chunk.end}`);

      // Clean up chunk file
      await rm(chunkPath, { force: true });
    }

    await updateVideo(videoId, { status: "ready" });
    console.log(`[Worker] Video ${videoId} fully processed`);

    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Failed to process video ${videoId}:`, message);
    await updateVideo(videoId, { status: "failed", errorMessage: message });
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
