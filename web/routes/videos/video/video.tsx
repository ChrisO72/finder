import { useSearchParams, useRevalidator, redirect, Link } from "react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getAuthenticatedUser } from "~/lib/session.server";
import { getVideoByIdForOrg, softDeleteVideo, updateVideo } from "~/db/repositories/videos";
import { getSegmentsByVideoId } from "~/db/repositories/segments";
import { getTagsForVideo } from "~/db/repositories/tags";
import { enqueueJob } from "~/worker/enqueue";
import { processVideoJobName } from "~/worker/jobs/process-video";
import { parseForm, type ActionData } from "~/lib/form";
import { z } from "zod";
import { VideoPlayer } from "./video-player";
import type { VideoPlayerHandle } from "./video-player";
import { VideoInfo } from "./video-info";
import { TranscriptPanel } from "./transcript-panel";
import type { Route } from "./+types/video";

const videoActionSchema = z.object({
  intent: z.enum(["continue", "delete"]),
});

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = getAuthenticatedUser(context);

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

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionData | Response> {
  const user = getAuthenticatedUser(context);

  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, videoActionSchema);
  if (fieldErrors) return { fieldErrors };

  const videoId = parseInt(params.id, 10);
  if (isNaN(videoId)) throw new Response("Not found", { status: 404 });

  if (data.intent === "continue") {
    const video = await getVideoByIdForOrg(videoId, user.organizationId);
    if (!video || video.status !== "failed") {
      throw new Response("Bad request", { status: 400 });
    }
    await updateVideo(videoId, { status: "pending", errorMessage: null });
    await enqueueJob(processVideoJobName, { videoId });
    return {};
  }

  if (data.intent === "delete") {
    await softDeleteVideo(videoId, user.organizationId);
    return redirect("/videos");
  }

  throw new Response("Bad request", { status: 400 });
}

export default function VideoDetailPage({ loaderData }: Route.ComponentProps) {
  const { video, segments, videoTags } = loaderData;
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [playerHandle, setPlayerHandle] = useState<VideoPlayerHandle | null>(null);

  const searchQuery = searchParams.get("q") || "";
  const searchMode = searchParams.get("mode") as "keyword" | "semantic" | null;
  const matchedSegmentId = searchParams.get("sid") ? parseInt(searchParams.get("sid")!, 10) : null;
  const matchFrom = searchParams.get("from") ? parseFloat(searchParams.get("from")!) : null;
  const matchTo = searchParams.get("to") ? parseFloat(searchParams.get("to")!) : null;
  const initialTime = parseInt(searchParams.get("t") ?? "0", 10);
  const isProcessing = video.status === "processing" || video.status === "pending";

  // Poll while processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [isProcessing, revalidator]);

  const handlePlayerRef = useCallback((ref: VideoPlayerHandle) => {
    setPlayerHandle(ref);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* Back link */}
      <Link
        to={
          searchQuery
            ? `/?q=${encodeURIComponent(searchQuery)}&mode=${searchMode ?? "semantic"}`
            : "/videos"
        }
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <ArrowLeftIcon className="size-3.5" />
        {searchQuery ? "Back to search results" : "Back to videos"}
      </Link>

      {/* 50/50 horizontal split, single column on mobile */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row md:overflow-hidden">
        {/* Left: Video + Info */}
        <div className="flex min-w-0 flex-shrink-0 flex-col md:flex-1 md:overflow-hidden md:pr-2">
          <div className="shrink-0">
            <VideoPlayer
              youtubeVideoId={video.youtubeVideoId}
              initialTime={initialTime}
              onPlayerRef={handlePlayerRef}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VideoInfo video={video} tags={videoTags} />
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="flex min-h-[50vh] min-w-0 flex-col md:min-h-0 md:flex-1">
          <TranscriptPanel
            segments={segments}
            playerHandle={playerHandle}
            searchQuery={searchQuery}
            searchMode={searchMode}
            matchedSegmentId={matchedSegmentId}
            matchFrom={matchFrom}
            matchTo={matchTo}
            isProcessing={isProcessing}
            videoStatus={video.status}
          />
        </div>
      </div>
    </div>
  );
}
