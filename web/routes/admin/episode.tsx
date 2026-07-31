import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { Link, redirect, useRevalidator, useSearchParams } from "react-router";
import { z } from "zod";
import { Badge } from "~/components/ui-kit/badge";
import { Button } from "~/components/ui-kit/button";
import { Dialog, DialogActions, DialogDescription, DialogTitle } from "~/components/ui-kit/dialog";
import { getEpisodeByIdForOrg, softDeleteEpisode, updateEpisode } from "~/db/repositories/episodes";
import { getSegmentsByEpisodeId } from "~/db/repositories/segments";
import { getTagsForEpisode } from "~/db/repositories/tags";
import { parseForm, type ActionData } from "~/lib/form";
import { requireAdmin } from "~/lib/session.server";
import { enqueueJob } from "~/worker/enqueue";
import { processEpisodeJobName } from "~/worker/jobs/process-episode";
import { AudioPlayer, type AudioPlayerHandle } from "./audio-player";
import { TranscriptPanel } from "./transcript-panel";
import type { Route } from "./+types/episode";

const episodeActionSchema = z.object({
  intent: z.enum(["retry", "delete"]),
});

export function meta() {
  return [{ title: "Episode · Finder" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const { user } = requireAdmin(context);
  const episodeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(episodeId)) throw new Response("Not found", { status: 404 });

  const episode = await getEpisodeByIdForOrg(episodeId, user.organizationId);
  if (!episode) throw new Response("Not found", { status: 404 });

  const [segments, tags] = await Promise.all([
    getSegmentsByEpisodeId(episode.id),
    getTagsForEpisode(episode.id),
  ]);
  return { episode, segments, tags };
}

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionData | Response> {
  const { user } = requireAdmin(context);
  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, episodeActionSchema);
  if (fieldErrors) return { fieldErrors };

  const episodeId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(episodeId)) throw new Response("Not found", { status: 404 });
  const episode = await getEpisodeByIdForOrg(episodeId, user.organizationId);
  if (!episode) throw new Response("Not found", { status: 404 });

  if (data.intent === "delete") {
    await softDeleteEpisode(episodeId, user.organizationId);
    return redirect("/admin/episodes");
  }

  if (episode.status !== "failed") {
    throw new Response("Only failed episodes can be retried", { status: 400 });
  }
  await updateEpisode(episodeId, { status: "pending", errorMessage: null });
  await enqueueJob(processEpisodeJobName, { episodeId });
  return {};
}

export default function EpisodePage({ loaderData }: Route.ComponentProps) {
  const { episode, segments, tags } = loaderData;
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [player, setPlayer] = useState<AudioPlayerHandle | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isProcessing = episode.status === "pending" || episode.status === "processing";
  const initialTime = Number.parseInt(searchParams.get("t") ?? "0", 10) || 0;
  const searchQuery = searchParams.get("q") ?? "";
  const setPlayerHandle = useCallback((handle: AudioPlayerHandle) => setPlayer(handle), []);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = window.setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isProcessing, revalidator]);

  const progress =
    episode.durationSeconds && episode.durationSeconds > 0
      ? Math.min(100, Math.round((episode.processedSeconds / episode.durationSeconds) * 100))
      : 0;

  return (
    <div>
      <Link
        to={searchQuery ? `/admin?q=${encodeURIComponent(searchQuery)}` : "/admin/episodes"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
      >
        <ArrowLeftIcon className="size-4" />
        {searchQuery ? "Back to search" : "All episodes"}
      </Link>

      <div className="grid min-h-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0">
          <div className="flex gap-5">
            {episode.artworkUrl ? (
              <img
                src={episode.artworkUrl}
                alt=""
                className="size-28 shrink-0 rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div className="size-28 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            )}
            <div className="min-w-0 self-center">
              <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                {episode.podcastTitle}
              </p>
              <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-zinc-950 dark:text-white">
                {episode.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {episode.publishedAt && <span>{episode.publishedAt.toLocaleDateString()}</span>}
                {episode.durationSeconds && <span>{formatTimestamp(episode.durationSeconds)}</span>}
                {episode.status !== "ready" && (
                  <Badge color={episode.status === "failed" ? "red" : "zinc"}>
                    {episode.status === "processing" ? `${progress}% processed` : episode.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <AudioPlayer
              audioUrl={episode.audioUrl}
              initialTime={initialTime}
              onPlayerRef={setPlayerHandle}
            />
          </div>

          {isProcessing && (
            <div className="mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all dark:bg-white"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Processed {formatTimestamp(episode.processedSeconds)}
                {episode.durationSeconds ? ` of ${formatTimestamp(episode.durationSeconds)}` : ""}
              </p>
            </div>
          )}

          {episode.status === "failed" && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 dark:bg-red-500/10">
              <p className="text-sm text-red-700 dark:text-red-400">
                {episode.errorMessage || "Processing failed."}
              </p>
              <form method="post" className="mt-3">
                <input type="hidden" name="intent" value="retry" />
                <Button type="submit" outline>
                  <ArrowPathIcon data-slot="icon" />
                  Retry
                </Button>
              </form>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/admin?tag=${encodeURIComponent(tag.slug)}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {episode.summary && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                Summary
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {episode.summary}
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {episode.episodeUrl && (
              <a
                href={episode.episodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                Original episode
                <ArrowTopRightOnSquareIcon className="size-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
            >
              <TrashIcon className="size-4" />
              Delete
            </button>
          </div>
        </section>

        <TranscriptPanel
          segments={segments}
          player={player}
          searchQuery={searchQuery}
          isProcessing={isProcessing}
          status={episode.status}
        />
      </div>

      <Dialog open={deleteOpen} onClose={setDeleteOpen} size="sm">
        <DialogTitle>Delete episode</DialogTitle>
        <DialogDescription>
          Remove “{episode.title}” and its transcript from Finder?
        </DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <form method="post">
            <input type="hidden" name="intent" value="delete" />
            <Button type="submit" color="red">
              Delete
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </div>
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
