import {
  useLoaderData,
  useSearchParams,
  useRevalidator,
  Link,
} from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    YT: { Player: new (...args: any[]) => any };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}
import { ClockIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import { getVideoByIdForOrg } from "~/db/repositories/videos";
import { getSegmentsByVideoId } from "~/db/repositories/segments";
import { Badge } from "~/components/ui-kit/badge";
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
    video.status === "ready" || video.status === "processing"
      ? await getSegmentsByVideoId(video.id)
      : [];

  return { video, segments };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoDetailPage() {
  const { video, segments } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  const initialTime = parseInt(searchParams.get("t") ?? "0", 10);
  const isProcessing =
    video.status === "processing" || video.status === "pending";

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

  // Highlight initial segment based on ?t
  useEffect(() => {
    if (initialTime > 0 && segments.length > 0) {
      const match = segments.find(
        (s) => s.startSeconds <= initialTime && s.endSeconds > initialTime,
      );
      if (match) setActiveSegmentId(match.id);
    }
  }, [initialTime, segments]);

  const progress =
    video.durationSeconds && video.durationSeconds > 0
      ? Math.round((video.processedSeconds / video.durationSeconds) * 100)
      : 0;

  return (
    <div>
      <Link
        to="/videos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Videos
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Player column */}
        <div className="lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <div id="yt-player" className="absolute inset-0 h-full w-full" />
          </div>

          <div className="mt-4">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {video.title ?? "Processing..."}
            </h1>
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

            {video.status === "failed" && video.errorMessage && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {video.errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Transcript column */}
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            Transcript
          </h2>
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
            <div className="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => {
                    seekTo(seg.startSeconds);
                    setActiveSegmentId(seg.id);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left transition ${
                    activeSegmentId === seg.id
                      ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="mr-2 inline-block text-xs font-medium text-blue-600 dark:text-blue-400">
                    {formatTimestamp(seg.startSeconds)}
                  </span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {seg.text}
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
