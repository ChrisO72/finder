import { execFile } from "node:child_process";
import { promisify } from "node:util";
import youtubeDl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";

const exec = promisify(execFile);

export type VideoMetadata = {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: string | null;
};

export async function fetchVideoMetadata(
  youtubeUrl: string,
): Promise<VideoMetadata> {
  const info = (await youtubeDl(youtubeUrl, {
    dumpJson: true,
    skipDownload: true,
    jsRuntimes: "node",
  })) as Record<string, unknown>;

  return {
    title: (info.title as string) ?? "Untitled",
    channelTitle:
      (info.uploader as string) ?? (info.channel as string) ?? "Unknown",
    thumbnailUrl: (info.thumbnail as string) ?? null,
    durationSeconds: (info.duration as number) ?? 0,
    publishedAt: info.upload_date
      ? `${(info.upload_date as string).slice(0, 4)}-${(info.upload_date as string).slice(4, 6)}-${(info.upload_date as string).slice(6, 8)}`
      : null,
  };
}

export async function downloadAudio(
  youtubeUrl: string,
  outputPath: string,
): Promise<void> {
  await youtubeDl.exec(youtubeUrl, {
    extractAudio: true,
    audioFormat: "m4a",
    output: outputPath,
    ffmpegLocation: ffmpegPath!,
    jsRuntimes: "node",
  });
}

export async function extractChunk(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
): Promise<void> {
  await exec(ffmpegPath!, [
    "-y",
    "-i",
    inputPath,
    "-ss",
    String(startSec),
    "-to",
    String(endSec),
    "-vn",
    "-acodec",
    "copy",
    outputPath,
  ]);
}
