import { Link, redirect, useLoaderData, useRevalidator } from "react-router";
import { useEffect } from "react";
import {
  PlayCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { z } from "zod";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import {
  listVideosByOrg,
  countVideosByOrg,
  createVideo,
} from "~/db/repositories/videos";
import { Heading } from "~/components/ui-kit/heading";
import { Badge } from "~/components/ui-kit/badge";
import { AddVideoDialog } from "./AddVideoDialog";
import { defaultQueue } from "../../../worker/queues";
import type { Route } from "./+types/index";

const addVideoSchema = z.object({
  youtubeUrl: z.string().url("Please enter a valid URL"),
});

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      return u.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 12;

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const [videos, totalCount] = await Promise.all([
    listVideosByOrg(user.organizationId, page, PAGE_SIZE),
    countVideosByOrg(user.organizationId),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasProcessing = videos.some((v) => v.status === "processing" || v.status === "pending");

  return { videos, page, totalPages, totalCount, hasProcessing };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = addVideoSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  const videoId = extractYouTubeId(result.data.youtubeUrl);
  if (!videoId) {
    return {
      success: false as const,
      errors: { youtubeUrl: ["Could not extract a YouTube video ID from this URL"] },
    };
  }

  const video = await createVideo({
    organizationId: user.organizationId,
    youtubeUrl: result.data.youtubeUrl,
    youtubeVideoId: videoId,
  });

  await defaultQueue.add("process-video", { videoId: video.id });

  return redirect("/videos");
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const statusConfig = {
  pending: { label: "Pending", color: "zinc" as const },
  processing: { label: "Processing", color: "blue" as const },
  ready: { label: "Ready", color: "green" as const },
  failed: { label: "Failed", color: "red" as const },
};

export default function VideosPage() {
  const { videos, page, totalPages, totalCount, hasProcessing } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [hasProcessing, revalidator]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <Heading>
          Videos
          {totalCount > 0 && (
            <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
              ({totalCount})
            </span>
          )}
        </Heading>
        <AddVideoDialog />
      </div>

      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <PlayCircleIcon className="mx-auto mb-3 size-12 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No videos yet. Add your first one!
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => {
              const cfg = statusConfig[video.status];
              const progress =
                video.status === "processing" &&
                video.durationSeconds &&
                video.durationSeconds > 0
                  ? Math.round(
                      (video.processedSeconds / video.durationSeconds) * 100,
                    )
                  : null;

              return (
                <Link
                  key={video.id}
                  to={`/videos/${video.id}`}
                  className="group overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:hover:border-zinc-600"
                >
                  <div className="relative">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title ?? ""}
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                        <PlayCircleIcon className="size-10 text-zinc-400" />
                      </div>
                    )}
                    {video.durationSeconds && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                        {formatDuration(video.durationSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-zinc-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {video.title ?? "Processing..."}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {video.channelTitle && (
                        <span className="truncate text-xs text-zinc-500">
                          {video.channelTitle}
                        </span>
                      )}
                      <Badge color={cfg.color}>
                        {cfg.label}
                        {progress !== null && ` ${progress}%`}
                      </Badge>
                    </div>
                    {video.status === "processing" && progress !== null && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    {video.status === "failed" && video.errorMessage && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <ExclamationTriangleIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{video.errorMessage}</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  to={`?page=${page - 1}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  to={`?page=${page + 1}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
