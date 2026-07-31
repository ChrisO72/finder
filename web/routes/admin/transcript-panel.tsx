import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioPlayerHandle } from "./audio-player";

type Segment = {
  id: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

type Chunk = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export function TranscriptPanel({
  segments,
  player,
  searchQuery,
  isProcessing,
  status,
}: {
  segments: Segment[];
  player: AudioPlayerHandle | null;
  searchQuery: string;
  isProcessing: boolean;
  status: string;
}) {
  const chunks = useMemo(() => groupSegments(segments), [segments]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!player || chunks.length === 0) return;
    const interval = window.setInterval(() => {
      if (!player.isPlaying()) return;
      const time = player.getCurrentTime();
      const index = chunks.findIndex(
        (chunk) => chunk.startSeconds <= time && chunk.endSeconds > time,
      );
      if (index >= 0) setActiveIndex(index);
    }, 300);
    return () => window.clearInterval(interval);
  }, [chunks, player]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  return (
    <section className="flex min-h-[32rem] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Transcript</h2>
        {segments.length > 0 && (
          <span className="text-xs text-zinc-400">{segments.length} segments</span>
        )}
      </div>

      {segments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-400">
            {isProcessing
              ? "Transcript will appear as this episode is processed…"
              : status === "failed"
                ? "Transcription failed."
                : "No transcript available."}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
          {chunks.map((chunk, index) => (
            <button
              key={`${chunk.startSeconds}-${index}`}
              ref={activeIndex === index ? activeRef : undefined}
              type="button"
              onClick={() => {
                player?.seekTo(chunk.startSeconds);
                setActiveIndex(index);
              }}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                activeIndex === index
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <span className="mr-2 inline-block font-mono text-[11px] text-zinc-400 tabular-nums">
                {formatTimestamp(chunk.startSeconds)}
              </span>
              <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {searchQuery ? highlightWords(chunk.text, searchQuery) : chunk.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function groupSegments(segments: Segment[], windowSeconds = 20): Chunk[] {
  if (segments.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: Chunk = {
    startSeconds: segments[0].startSeconds,
    endSeconds: segments[0].endSeconds,
    text: segments[0].text,
  };

  for (const segment of segments.slice(1)) {
    if (segment.startSeconds - current.startSeconds < windowSeconds) {
      current.endSeconds = segment.endSeconds;
      current.text += ` ${segment.text}`;
    } else {
      chunks.push(current);
      current = {
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        text: segment.text,
      };
    }
  }
  chunks.push(current);
  return chunks;
}

function highlightWords(text: string, query: string) {
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const checker = new RegExp(`^(?:${words.join("|")})$`, "i");
  return text.split(pattern).map((part, index) =>
    checker.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200 px-0.5 dark:bg-amber-500/30 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function formatTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
