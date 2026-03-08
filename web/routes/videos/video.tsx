import {
  useLoaderData,
  useSearchParams,
  useRevalidator,
  useFetcher,
  redirect,
  Link,
} from "react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

declare global {
  interface Window {
    YT: { Player: new (...args: any[]) => any };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}
import {
  ClockIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import {
  getVideoByIdForOrg,
  softDeleteVideo,
  updateVideo,
} from "~/db/repositories/videos";
import { getSegmentsByVideoId } from "~/db/repositories/segments";
import { getTagsForVideo } from "~/db/repositories/tags";
import { getTagColorClass } from "~/lib/tag-colors";
import { defaultQueue } from "../../../worker/queues";
import { Badge } from "~/components/ui-kit/badge";
import { Button } from "~/components/ui-kit/button";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from "~/components/ui-kit/dialog";
import type { Route } from "./+types/video";

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const videoId = parseInt(params.id, 10);
  if (isNaN(videoId)) throw new Response("Not found", { status: 404 });

  const video = await getVideoByIdForOrg(videoId, user.organizationId);
  if (!video) throw new Response("Not found", { status: 404 });

  const segments =
    video.status === "ready" || video.status === "processing" || video.status === "failed"
      ? await getSegmentsByVideoId(video.id)
      : [];

  const videoTags = video.status === "ready" ? await getTagsForVideo(video.id) : [];

  return { video, segments, videoTags };
}

export async function action({ request, params }: Route.ActionArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  const videoId = parseInt(params.id, 10);
  if (isNaN(videoId)) throw new Response("Not found", { status: 404 });

  if (intent === "continue") {
    const video = await getVideoByIdForOrg(videoId, user.organizationId);
    if (!video || video.status !== "failed") {
      throw new Response("Bad request", { status: 400 });
    }
    await updateVideo(videoId, { status: "pending", errorMessage: null });
    await defaultQueue.add("process-video", { videoId });
    return { continued: true };
  }

  if (intent === "delete") {
    await softDeleteVideo(videoId, user.organizationId);
    return redirect("/videos");
  }

  throw new Response("Bad request", { status: 400 });
}

type Segment = { id: number; startSeconds: number; endSeconds: number; text: string };

type Chunk = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  segmentIds: number[];
};

function groupSegments(segments: Segment[], windowSeconds = 30): Chunk[] {
  if (segments.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: Chunk = {
    startSeconds: segments[0].startSeconds,
    endSeconds: segments[0].endSeconds,
    text: segments[0].text,
    segmentIds: [segments[0].id],
  };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startSeconds - current.startSeconds < windowSeconds) {
      current.endSeconds = seg.endSeconds;
      current.text += " " + seg.text;
      current.segmentIds.push(seg.id);
    } else {
      chunks.push(current);
      current = {
        startSeconds: seg.startSeconds,
        endSeconds: seg.endSeconds,
        text: seg.text,
        segmentIds: [seg.id],
      };
    }
  }
  chunks.push(current);
  return chunks;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function highlightWords(text: string, query: string): React.ReactNode {
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(pattern);
  const checker = new RegExp(`^(?:${words.join("|")})$`, "i");
  return (
    <>
      {parts.map((part, i) =>
        checker.test(part) ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/30 dark:text-yellow-200"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function VideoDetailPage() {
  const { video, segments, videoTags } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const fetcher = useFetcher();
  const playerRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [playerReady, setPlayerReady] = useState(false);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);
  const [activeChunkIdx, setActiveChunkIdx] = useState<number | null>(null);
  const [chunkWindow, setChunkWindow] = useState(10);
  const chunks = useMemo(
    () => groupSegments(segments as Segment[], chunkWindow),
    [segments, chunkWindow],
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isDeleting = fetcher.state !== "idle";

  const searchQuery = searchParams.get("q") || "";
  const searchMode = searchParams.get("mode") as
    | "keyword"
    | "semantic"
    | null;
  const matchedSegmentId = searchParams.get("sid")
    ? parseInt(searchParams.get("sid")!, 10)
    : null;
  const matchFrom = searchParams.get("from")
    ? parseFloat(searchParams.get("from")!)
    : null;
  const matchTo = searchParams.get("to")
    ? parseFloat(searchParams.get("to")!)
    : null;

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

  const initialTime = parseInt(searchParams.get("t") ?? "0", 10);
  const isProcessing =
    video.status === "processing" || video.status === "pending";

  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setVideoHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Poll while processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [isProcessing, revalidator]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (window.YT?.Player) {
      createPlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => createPlayer();

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  function createPlayer() {
    if (playerRef.current) return;
    playerRef.current = new window.YT.Player("yt-player", {
      videoId: video.youtubeVideoId,
      playerVars: {
        autoplay: 0,
        start: initialTime || undefined,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => setPlayerReady(true),
      },
    });
  }

  const seekTo = useCallback(
    (seconds: number) => {
      if (playerRef.current && playerReady) {
        playerRef.current.seekTo(seconds, true);
        playerRef.current.playVideo();
      }
    },
    [playerReady],
  );

  // Auto-seek on load if ?t param
  useEffect(() => {
    if (playerReady && initialTime > 0) {
      seekTo(initialTime);
    }
  }, [playerReady, initialTime, seekTo]);

  // Highlight initial chunk based on ?t
  useEffect(() => {
    if (initialTime > 0 && chunks.length > 0) {
      const idx = chunks.findIndex(
        (c) => c.startSeconds <= initialTime && c.endSeconds > initialTime,
      );
      if (idx !== -1) setActiveChunkIdx(idx);
    }
  }, [initialTime, chunks]);

  // Poll playback position and highlight the current chunk in real time
  useEffect(() => {
    if (!playerReady || chunks.length === 0) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getPlayerState || !player?.getCurrentTime) return;
      if (player.getPlayerState() !== 1) return; // 1 = playing
      const time = player.getCurrentTime();
      const idx = chunks.findIndex(
        (c) => c.startSeconds <= time && c.endSeconds > time,
      );
      if (idx !== -1) setActiveChunkIdx(idx);
    }, 250);
    return () => clearInterval(interval);
  }, [playerReady, chunks]);

  // Scroll active chunk into the center of the transcript container
  useEffect(() => {
    if (activeChunkIdx === null) return;
    const el = chunkRefs.current.get(activeChunkIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeChunkIdx]);

  const progress =
    video.durationSeconds && video.durationSeconds > 0
      ? Math.round((video.processedSeconds / video.durationSeconds) * 100)
      : 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Link
        to={
          searchQuery
            ? `/?q=${encodeURIComponent(searchQuery)}&mode=${searchMode ?? "semantic"}`
            : "/videos"
        }
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeftIcon className="size-4" />
        {searchQuery ? "Back to search results" : "Back to Videos"}
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* Player + Summary */}
        <div className="flex shrink-0 gap-6">
          <div className="min-w-0 flex-2">
          <div ref={videoContainerRef} className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <div id="yt-player" className="absolute inset-0 h-full w-full" />
          </div>

          <div className="mt-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {video.title ?? "Processing..."}
              </h1>
              <Button
                plain
                onClick={() => setDeleteOpen(true)}
                className="shrink-0 text-red-600 data-hover:text-red-700 dark:text-red-400 dark:data-hover:text-red-300"
              >
                <TrashIcon className="size-5" />
              </Button>
            </div>

            <Dialog open={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)} size="sm">
              <DialogTitle>Delete video</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{video.title ?? "this video"}&rdquo;? This action cannot be undone.
              </DialogDescription>
              <DialogActions>
                <Button plain onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <Button type="submit" color="red" disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </fetcher.Form>
              </DialogActions>
            </Dialog>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              {video.channelTitle && <span>{video.channelTitle}</span>}
              {video.durationSeconds && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-4" />
                  {formatTimestamp(video.durationSeconds)}
                </span>
              )}
              <Badge
                color={
                  video.status === "ready"
                    ? "green"
                    : video.status === "failed"
                      ? "red"
                      : video.status === "processing"
                        ? "blue"
                        : "zinc"
                }
              >
                {video.status === "processing"
                  ? `Processing ${progress}%`
                  : video.status.charAt(0).toUpperCase() + video.status.slice(1)}
              </Badge>
            </div>

            {isProcessing && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Transcribing... {formatTimestamp(video.processedSeconds)} /{" "}
                  {video.durationSeconds
                    ? formatTimestamp(video.durationSeconds)
                    : "?"}
                </p>
              </div>
            )}

            {videoTags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {videoTags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/?tag=${encodeURIComponent(tag.slug)}`}
                    className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${getTagColorClass(tag.name)}`}
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}

            {video.status === "failed" && (
              <div className="mt-3 space-y-3">
                {video.errorMessage && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    {video.errorMessage}
                  </p>
                )}
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="continue" />
                  <Button
                    type="submit"
                    color="blue"
                    disabled={fetcher.state !== "idle"}
                  >
                    <ArrowPathIcon className="size-4" />
                    {fetcher.state !== "idle" ? "Resuming..." : "Continue processing"}
                  </Button>
                </fetcher.Form>
              </div>
            )}
          </div>
          </div>

          {video.summary && (
            <div
              className="flex flex-1 flex-col"
              style={videoHeight ? { maxHeight: videoHeight } : undefined}
            >
              <h2 className="mb-2 shrink-0 text-sm font-semibold text-zinc-900 dark:text-white">Summary</h2>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {video.summary}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex min-h-0 flex-1 flex-col">
          {searchQuery && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
              <MagnifyingGlassIcon className="size-4 shrink-0 text-zinc-400" />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                &ldquo;{searchQuery}&rdquo;
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  searchMode === "keyword"
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300"
                    : "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300"
                }`}
              >
                {searchMode === "keyword" ? "Keyword" : "Semantic"}
              </span>
            </div>
          )}
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Transcript
            </h2>
            {segments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Chunk</span>
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
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
                  className="w-14 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-center text-xs tabular-nums dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                />
                <span className="text-xs text-zinc-400 dark:text-zinc-500">sec</span>
              </div>
            )}
          </div>
          {segments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isProcessing
                  ? "Transcript will appear here as the video is processed..."
                  : video.status === "failed"
                    ? "Transcription failed."
                    : "No transcript available."}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
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
                          ? "bg-yellow-50 ring-1 ring-yellow-300 dark:bg-yellow-500/10 dark:ring-yellow-500/30"
                          : "bg-purple-50 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:ring-purple-500/30"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="mr-2 inline-block align-top text-xs font-medium text-blue-600 dark:text-blue-400">
                    {formatTimestamp(chunk.startSeconds)}
                  </span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
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
      </div>
    </div>
  );
}
