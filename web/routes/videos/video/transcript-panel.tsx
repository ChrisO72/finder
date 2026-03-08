import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import type { Chunk, Segment } from "./utils";
import { groupSegments, formatTimestamp, highlightWords } from "./utils";
import type { VideoPlayerHandle } from "./video-player";

interface TranscriptPanelProps {
  segments: Segment[];
  playerHandle: VideoPlayerHandle | null;
  searchQuery: string;
  searchMode: "keyword" | "semantic" | null;
  matchedSegmentId: number | null;
  matchFrom: number | null;
  matchTo: number | null;
  isProcessing: boolean;
  videoStatus: string;
}

export function TranscriptPanel({
  segments,
  playerHandle,
  searchQuery,
  searchMode,
  matchedSegmentId,
  matchFrom,
  matchTo,
  isProcessing,
  videoStatus,
}: TranscriptPanelProps) {
  const chunkRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [activeChunkIdx, setActiveChunkIdx] = useState<number | null>(null);
  const [chunkWindow, setChunkWindow] = useState(10);

  const chunks = useMemo(
    () => groupSegments(segments, chunkWindow),
    [segments, chunkWindow],
  );

  const matchedChunkIndices = useMemo(() => {
    const indices = new Set<number>();
    if (searchMode === "keyword" && matchedSegmentId !== null) {
      chunks.forEach((chunk, idx) => {
        if (chunk.segmentIds.includes(matchedSegmentId)) indices.add(idx);
      });
    } else if (
      searchMode === "semantic" &&
      matchFrom !== null &&
      matchTo !== null
    ) {
      chunks.forEach((chunk, idx) => {
        if (chunk.startSeconds < matchTo && chunk.endSeconds > matchFrom)
          indices.add(idx);
      });
    }
    return indices;
  }, [chunks, searchMode, matchedSegmentId, matchFrom, matchTo]);

  const seekTo = useCallback(
    (seconds: number) => {
      playerHandle?.seekTo(seconds);
    },
    [playerHandle],
  );

  // Poll playback position to highlight active chunk
  useEffect(() => {
    if (!playerHandle || chunks.length === 0) return;
    const interval = setInterval(() => {
      if (playerHandle.getPlayerState() !== 1) return;
      const time = playerHandle.getCurrentTime();
      const idx = chunks.findIndex(
        (c) => c.startSeconds <= time && c.endSeconds > time,
      );
      if (idx !== -1) setActiveChunkIdx(idx);
    }, 250);
    return () => clearInterval(interval);
  }, [playerHandle, chunks]);

  // Scroll active chunk into view
  useEffect(() => {
    if (activeChunkIdx === null) return;
    const el = chunkRefs.current.get(activeChunkIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeChunkIdx]);

  // Highlight initial matched chunks
  useEffect(() => {
    if (matchedChunkIndices.size > 0 && activeChunkIdx === null) {
      const first = Array.from(matchedChunkIndices)[0];
      setActiveChunkIdx(first);
    }
  }, [matchedChunkIndices]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Transcript
        </h2>
        {segments.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Chunk
            </span>
            {[5, 10, 20, 30].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setChunkWindow(preset);
                  setActiveChunkIdx(null);
                }}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  chunkWindow === preset
                    ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-400"
                }`}
              >
                {preset}s
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={600}
              value={chunkWindow}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v > 0) {
                  setChunkWindow(v);
                  setActiveChunkIdx(null);
                }
              }}
              className="w-12 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-center text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            />
          </div>
        )}
      </div>

      {/* Search context */}
      {searchQuery && (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <MagnifyingGlassIcon className="size-3.5 shrink-0 text-zinc-400" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            &ldquo;{searchQuery}&rdquo;
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              searchMode === "keyword"
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
                : "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
            }`}
          >
            {searchMode === "keyword" ? "Keyword" : "Semantic"}
          </span>
        </div>
      )}

      {/* Transcript body */}
      {segments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {isProcessing
              ? "Transcript will appear as the video is processed..."
              : videoStatus === "failed"
                ? "Transcription failed."
                : "No transcript available."}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg border border-zinc-200 p-1.5 dark:border-zinc-700/50">
          {chunks.map((chunk, idx) => (
            <button
              key={idx}
              ref={(el) => {
                if (el) chunkRefs.current.set(idx, el);
                else chunkRefs.current.delete(idx);
              }}
              onClick={() => {
                seekTo(chunk.startSeconds);
                setActiveChunkIdx(idx);
              }}
              className={`w-full rounded-md px-3 py-2 text-left transition ${
                activeChunkIdx === idx
                  ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30"
                  : matchedChunkIndices.has(idx)
                    ? searchMode === "keyword"
                      ? "bg-yellow-50 ring-1 ring-yellow-200 dark:bg-yellow-500/10 dark:ring-yellow-500/30"
                      : "bg-purple-50 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:ring-purple-500/30"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <span className="mr-2 inline-block font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                {formatTimestamp(chunk.startSeconds)}
              </span>
              <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {searchMode === "keyword" &&
                matchedChunkIndices.has(idx) &&
                searchQuery
                  ? highlightWords(chunk.text, searchQuery)
                  : chunk.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
