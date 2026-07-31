import {
  ArrowPathIcon,
  ClockIcon,
  ExclamationCircleIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { Form, Link, useActionData, useNavigation, useRevalidator } from "react-router";
import { z } from "zod";
import { FieldError } from "~/components/field-error";
import { FormError } from "~/components/form-error";
import { Button } from "~/components/ui-kit/button";
import { Field, Label } from "~/components/ui-kit/fieldset";
import { Heading } from "~/components/ui-kit/heading";
import { Input } from "~/components/ui-kit/input";
import { countEpisodesByOrg, listEpisodesByOrg } from "~/db/repositories/episodes";
import { listPodcastFeedsByOrg } from "~/db/repositories/podcastFeeds";
import { addAndSyncPodcastFeed, syncPodcastFeed } from "~/lib/buzzsprout.server";
import { parseForm, type ActionData } from "~/lib/form";
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/episodes";

const PAGE_SIZE = 20;

const feedActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("add"),
    feedUrl: z.url("Enter a valid Buzzsprout RSS URL"),
  }),
  z.object({
    intent: z.literal("sync"),
    feedId: z.coerce.number().int().positive(),
  }),
]);

type FeedActionData = ActionData & {
  success?: string;
};

export function meta() {
  return [{ title: "Episodes · Finder" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = requireAdmin(context);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const [feeds, episodes, totalCount] = await Promise.all([
    listPodcastFeedsByOrg(user.organizationId),
    listEpisodesByOrg(user.organizationId, page, PAGE_SIZE),
    countEpisodesByOrg(user.organizationId),
  ]);

  return {
    feeds,
    episodes,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    totalCount,
    hasProcessing: episodes.some(
      (episode) => episode.status === "pending" || episode.status === "processing",
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs): Promise<FeedActionData> {
  const { user } = requireAdmin(context);
  const formData = await request.formData();
  const { data, fieldErrors } = parseForm(formData, feedActionSchema);
  if (fieldErrors) return { fieldErrors };

  try {
    const result =
      data.intent === "add"
        ? await addAndSyncPodcastFeed(user.organizationId, data.feedUrl)
        : await syncPodcastFeed(user.organizationId, data.feedId);
    return {
      success:
        result.importedCount === 0
          ? "Feed is up to date."
          : `Added ${result.importedCount} new episode${result.importedCount === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return { formError: error instanceof Error ? error.message : "Could not sync this feed" };
  }
}

export default function EpisodesPage({ loaderData }: Route.ComponentProps) {
  const { feeds, episodes, page, totalPages, totalCount, hasProcessing } = loaderData;
  const actionData = useActionData<FeedActionData>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = window.setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [hasProcessing, revalidator]);

  return (
    <div>
      <div className="mb-8">
        <Heading>Episodes</Heading>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Add a public Buzzsprout RSS feed. Finder only processes its public audio enclosures.
        </p>
      </div>

      <Form method="post" className="max-w-2xl rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
        <input type="hidden" name="intent" value="add" />
        <FormError actionData={actionData} />
        <Field>
          <Label>Buzzsprout RSS feed</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              name="feedUrl"
              type="url"
              required
              placeholder="https://feeds.buzzsprout.com/123456.rss"
              invalid={!!actionData?.fieldErrors?.feedUrl}
              className="flex-1"
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Syncing…" : "Add feed"}
            </Button>
          </div>
          <FieldError name="feedUrl" actionData={actionData} />
        </Field>
        {actionData?.success && !isSubmitting && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            {actionData.success}
          </p>
        )}
      </Form>

      {feeds.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            Saved feeds
          </h2>
          <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center gap-3 py-3">
                {feed.artworkUrl ? (
                  <img src={feed.artworkUrl} alt="" className="size-10 rounded-md object-cover" />
                ) : (
                  <div className="size-10 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                    {feed.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {feed.lastSyncedAt
                      ? `Synced ${feed.lastSyncedAt.toLocaleString()}`
                      : "Not synced"}
                  </p>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="sync" />
                  <input type="hidden" name="feedId" value={feed.id} />
                  <Button type="submit" plain disabled={isSubmitting}>
                    <ArrowPathIcon data-slot="icon" />
                    Sync
                  </Button>
                </Form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Archive</h2>
          <span className="text-xs text-zinc-400">
            {totalCount} episode{totalCount === 1 ? "" : "s"}
          </span>
        </div>

        {episodes.length === 0 ? (
          <div className="py-16 text-center">
            <MusicalNoteIcon className="mx-auto size-10 text-zinc-300 dark:text-zinc-700" />
            <p className="mt-3 text-sm text-zinc-500">No episodes yet.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/admin/episodes/${episode.id}`}
                className="flex items-center gap-4 py-4 transition hover:opacity-70"
              >
                {episode.artworkUrl ? (
                  <img
                    src={episode.artworkUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-16 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                    {episode.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{episode.podcastTitle}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    {episode.publishedAt && <span>{episode.publishedAt.toLocaleDateString()}</span>}
                    {episode.durationSeconds && (
                      <span>{formatDuration(episode.durationSeconds)}</span>
                    )}
                  </p>
                </div>
                <Status status={episode.status} />
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-4 text-sm">
            {page > 1 && <Link to={`?page=${page - 1}`}>Previous</Link>}
            <span className="text-zinc-400">
              {page} / {totalPages}
            </span>
            {page < totalPages && <Link to={`?page=${page + 1}`}>Next</Link>}
          </div>
        )}
      </section>
    </div>
  );
}

function Status({ status }: { status: "pending" | "processing" | "ready" | "failed" }) {
  if (status === "ready") {
    return <span className="text-xs text-emerald-600 dark:text-emerald-400">Ready</span>;
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
        <ExclamationCircleIcon className="size-4" />
        Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-zinc-500">
      <ClockIcon className="size-4" />
      {status === "pending" ? "Queued" : "Processing"}
    </span>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
