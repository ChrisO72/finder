import { readdirSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getEpisodeById, updateEpisode } from "~/db/repositories/episodes";
import { bulkInsertSegments, getSegmentsByEpisodeId } from "~/db/repositories/segments";
import { setEpisodeTags, upsertTag } from "~/db/repositories/tags";
import { bulkInsertWindows, deleteWindowsByEpisodeId } from "~/db/repositories/windows";
import { downloadAudio, extractChunk, probeAudioDuration } from "../lib/audio";
import { embedTexts } from "../lib/embed";
import { generateSummary } from "../lib/summarize";
import { generateTags, slugify } from "../lib/tags";
import { transcribeChunk } from "../lib/transcribe";

export const processEpisodeJobName = "process-episode" as const;

export type ProcessEpisodeJobData = {
  episodeId: number;
};

const CHUNK_SECONDS = 300;
const WINDOW_SECONDS = 60;
const STEP_SECONDS = 30;

export async function handleProcessEpisodeJob(data: ProcessEpisodeJobData) {
  const { episodeId } = data;
  const episode = await getEpisodeById(episodeId);
  if (!episode) {
    console.error(`[Worker] Episode ${episodeId} not found`);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), "finder", "episodes", String(episodeId));
  await mkdir(tmpDir, { recursive: true });
  const audioBase = path.join(tmpDir, "audio");

  try {
    await updateEpisode(episodeId, { status: "processing", errorMessage: null });

    let audioPath: string;
    const existingAudio = readdirSync(tmpDir).find((file) => file.startsWith("audio."));
    if (existingAudio) {
      audioPath = path.join(tmpDir, existingAudio);
    } else {
      console.log(`[Worker] Downloading public audio for episode ${episodeId}`);
      audioPath = await downloadAudio(episode.audioUrl, audioBase, episode.audioMimeType);
    }

    let duration = episode.durationSeconds ?? 0;
    if (duration <= 0) {
      duration = await probeAudioDuration(audioPath);
      await updateEpisode(episodeId, { durationSeconds: duration });
    }

    const audioExtension = path.extname(audioPath);
    const freshEpisode = await getEpisodeById(episodeId);
    const processedSeconds = freshEpisode?.processedSeconds ?? 0;
    const chunks: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < duration; start += CHUNK_SECONDS) {
      chunks.push({ start, end: Math.min(start + CHUNK_SECONDS, duration) });
    }

    for (const chunk of chunks) {
      if (chunk.end <= processedSeconds) continue;

      const chunkPath = path.join(tmpDir, `chunk_${chunk.start}_${chunk.end}${audioExtension}`);
      console.log(`[Worker] Transcribing episode ${episodeId}, ${chunk.start}-${chunk.end}s`);
      await extractChunk(audioPath, chunkPath, chunk.start, chunk.end);
      const transcriptSegments = await transcribeChunk(chunkPath, chunk.start);

      if (transcriptSegments.length > 0) {
        await bulkInsertSegments(
          transcriptSegments.map((segment) => ({
            episodeId,
            text: segment.text,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
          })),
        );
      }

      await updateEpisode(episodeId, { processedSeconds: chunk.end });
      await rm(chunkPath, { force: true });
    }

    const allSegments = await getSegmentsByEpisodeId(episodeId);
    const windowRows: Array<{ text: string; startSeconds: number; endSeconds: number }> = [];
    for (let windowStart = 0; windowStart < duration; windowStart += STEP_SECONDS) {
      const windowEnd = windowStart + WINDOW_SECONDS;
      const overlapping = allSegments.filter(
        (segment) => segment.startSeconds < windowEnd && segment.endSeconds > windowStart,
      );
      if (overlapping.length === 0) continue;
      windowRows.push({
        text: overlapping.map((segment) => segment.text).join(" "),
        startSeconds: Math.max(windowStart, overlapping[0].startSeconds),
        endSeconds: Math.min(windowEnd, overlapping[overlapping.length - 1].endSeconds),
      });
    }

    await deleteWindowsByEpisodeId(episodeId);
    if (windowRows.length > 0) {
      const embeddings = await embedTexts(windowRows.map((window) => window.text));
      await bulkInsertWindows(
        windowRows.map((window, index) => ({
          episodeId,
          text: window.text,
          startSeconds: window.startSeconds,
          endSeconds: window.endSeconds,
          embedding: embeddings[index],
        })),
      );
    }

    const fullTranscript = allSegments.map((segment) => segment.text).join(" ");
    if (fullTranscript.trim()) {
      const summary = await generateSummary(fullTranscript);
      const [summaryEmbedding] = await embedTexts([summary]);
      await updateEpisode(episodeId, { summary, summaryEmbedding });

      const tagNames = await generateTags(summary);
      const tagRows = await Promise.all(
        tagNames.map((name) => upsertTag(name, slugify(name), episode.organizationId)),
      );
      await setEpisodeTags(
        episodeId,
        tagRows.filter((tag) => tag !== undefined).map((tag) => tag.id),
      );
    }

    await updateEpisode(episodeId, { status: "ready" });
    await rm(tmpDir, { recursive: true, force: true });
    console.log(`[Worker] Episode ${episodeId} is ready`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Failed to process episode ${episodeId}:`, message);
    await updateEpisode(episodeId, { status: "failed", errorMessage: message });
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
