import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  const { stdout } = await exec("yt-dlp", [
    "--dump-json",
    "--no-download",
    youtubeUrl,
  ]);

  const info = JSON.parse(stdout);

  return {
    title: info.title ?? "Untitled",
    channelTitle: info.uploader ?? info.channel ?? "Unknown",
    thumbnailUrl: info.thumbnail ?? null,
    durationSeconds: info.duration ?? 0,
    publishedAt: info.upload_date
      ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}`
      : null,
  };
}

export async function downloadAudio(
  youtubeUrl: string,
  outputPath: string,
): Promise<void> {
  await exec("yt-dlp", [
    "-x",
    "--audio-format",
    "m4a",
    "-o",
    outputPath,
    youtubeUrl,
  ]);
}

export async function extractChunk(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
): Promise<void> {
  await exec("ffmpeg", [
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
