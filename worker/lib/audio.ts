import { createWriteStream } from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const exec = promisify(execFile);
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;

export async function downloadAudio(
  audioUrl: string,
  outputBase: string,
  mimeType: string | null,
): Promise<string> {
  const source = validateBuzzsproutAudioUrl(audioUrl);
  const response = await fetch(source, {
    headers: { "User-Agent": "Finder/1.0 audio processor" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Buzzsprout returned ${response.status} while downloading audio`);
  }

  validateBuzzsproutAudioUrl(response.url);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    throw new Error("The audio file is too large to process");
  }

  const extension = audioExtension(response.url, mimeType ?? response.headers.get("content-type"));
  const outputPath = `${outputBase}${extension}`;
  let downloadedBytes = 0;
  const limitStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length;
      callback(
        downloadedBytes > MAX_AUDIO_BYTES
          ? new Error("The audio file is too large to process")
          : null,
        chunk,
      );
    },
  });

  await pipeline(
    response.body as unknown as NodeJS.ReadableStream,
    limitStream,
    createWriteStream(outputPath),
  );
  return outputPath;
}

export async function probeAudioDuration(inputPath: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath!, ["-i", inputPath]);
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    process.on("error", reject);
    process.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (!match) {
        reject(new Error("Could not determine audio duration"));
        return;
      }
      resolve(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
    });
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

function validateBuzzsproutAudioUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (hostname !== "buzzsprout.com" && !hostname.endsWith(".buzzsprout.com"))
  ) {
    throw new Error("Audio must use a public HTTPS Buzzsprout URL");
  }
  return url;
}

function audioExtension(urlValue: string, mimeType: string | null): string {
  const extension = path.extname(new URL(urlValue).pathname).toLowerCase();
  if ([".mp3", ".m4a", ".mp4", ".ogg", ".opus", ".wav"].includes(extension)) {
    return extension;
  }

  const normalizedMime = mimeType?.split(";")[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
  };
  return normalizedMime ? (extensions[normalizedMime] ?? ".mp3") : ".mp3";
}
