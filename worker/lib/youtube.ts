import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import youtubeDl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";

const exec = promisify(execFile);

let _proxyUrl: string | undefined;
let _cookiesPath: string | undefined;

export function setProxyUrl(url: string | null | undefined) {
  _proxyUrl = url || undefined;
}

export function setCookies(cookieText: string | null | undefined) {
  if (!cookieText?.trim()) {
    _cookiesPath = undefined;
    return;
  }
  const p = path.join(os.tmpdir(), "yt-cookies.txt");
  writeFileSync(p, cookieText, "utf-8");
  _cookiesPath = p;
}

function proxyFlags(): Record<string, string | boolean> {
  const url = _proxyUrl ?? process.env.WEBSHARE_PROXY_URL;
  if (!url) return {};
  return { proxy: url };
}

function cookieFlags(): Record<string, string | boolean> {
  if (!_cookiesPath) return {};
  return { cookies: _cookiesPath };
}

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
    ...proxyFlags(),
    ...cookieFlags(),
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

/**
 * Downloads audio and returns the actual file path (extension chosen by yt-dlp).
 * `outputBase` should be the path without an extension, e.g. `/tmp/finder/12/abc123`
 */
export async function downloadAudio(
  youtubeUrl: string,
  outputBase: string,
): Promise<string> {
  const dir = path.dirname(outputBase);
  const stem = path.basename(outputBase);
  const outputTemplate = path.join(dir, `${stem}.%(ext)s`);

  const subprocess = youtubeDl.exec(youtubeUrl, {
    format: "bestaudio/best",
    output: outputTemplate,
    jsRuntimes: "node",
    newline: true,
    ...proxyFlags(),
    ...cookieFlags(),
  });

  let lastLog = 0;
  subprocess.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (!line.includes("[download]")) continue;
      const now = Date.now();
      if (now - lastLog < 10_000) continue;
      lastLog = now;
      console.log(`[yt-dlp] ${line.trim()}`);
    }
  });

  subprocess.stderr?.on("data", (data: Buffer) => {
    console.error(`[yt-dlp stderr] ${data.toString().trim()}`);
  });

  await subprocess;

  const files = await readdir(dir);
  const match = files.find((f) => f.startsWith(`${stem}.`));
  if (!match) throw new Error(`Download produced no file matching ${stem}.*`);
  return path.join(dir, match);
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
