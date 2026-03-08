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

function CircularProgress({ percent }: { percent: number }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);

  return (
    <svg className="size-16 drop-shadow-lg" viewBox="0 0 44 44">
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="2.5"
      />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-500"
        transform="rotate(-90 22 22)"
      />
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="11"
        fontWeight="600"
      >
        {percent}%
      </text>
    </svg>
  );
}

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
              const progress =
                video.status === "processing" &&
                  video.durationSeconds &&
                  video.durationSeconds > 0
                  ? Math.round(
                    (video.processedSeconds / video.durationSeconds) * 100,
                  )
                  : null;
              const hasOverlay = video.status !== "ready";

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
                      </div>
                    )}
                    {video.durationSeconds && !hasOverlay && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                        {formatDuration(video.durationSeconds)}
                      </span>
                    )}
                    {video.status === "processing" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <CircularProgress percent={progress ?? 0} />
                      </div>
                    )}
                    {video.status === "pending" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <ClockIcon className="size-8 text-white/70" />
                      </div>
                    )}
                    {video.status === "failed" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="flex flex-col items-center gap-1">
                          <ExclamationTriangleIcon className="size-8 text-red-400" />
                          <span className="text-xs font-semibold text-red-300">
                            Failed
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-zinc-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {video.title ?? "Processing…"}
                    </p>
                    {video.channelTitle && (
                      <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {video.channelTitle}
                      </span>
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
