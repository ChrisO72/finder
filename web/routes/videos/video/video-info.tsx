import { Link, useFetcher } from "react-router";
import { useState } from "react";
import {
  ClockIcon,
  TrashIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "~/components/ui-kit/badge";
import { Button } from "~/components/ui-kit/button";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from "~/components/ui-kit/dialog";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
} from "~/components/ui-kit/dropdown";
import { formatTimestamp } from "./utils";

interface VideoInfoProps {
  video: {
    id: number;
    title: string | null;
    channelTitle: string | null;
    durationSeconds: number | null;
    processedSeconds: number;
    status: string;
    summary: string | null;
    errorMessage: string | null;
  };
  tags: { id: number; name: string; slug: string }[];
}

export function VideoInfo({ video, tags }: VideoInfoProps) {
  const fetcher = useFetcher();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isDeleting = fetcher.state !== "idle";
  const isProcessing =
    video.status === "processing" || video.status === "pending";
  const progress =
    video.durationSeconds && video.durationSeconds > 0
      ? Math.round((video.processedSeconds / video.durationSeconds) * 100)
      : 0;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {/* Fixed: Title, metadata, tags, errors */}
      <div className="shrink-0 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold leading-tight text-zinc-900 dark:text-white">
            {video.title ?? "Processing..."}
          </h1>
          <Dropdown>
            <DropdownButton plain className="shrink-0 text-zinc-400 dark:text-zinc-500">
              <EllipsisVerticalIcon className="size-5" />
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              <DropdownItem onClick={() => setDeleteOpen(true)}>
                <TrashIcon className="size-4 " />
                <DropdownLabel >Delete</DropdownLabel>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <Dialog
          open={deleteOpen}
          onClose={() => !isDeleting && setDeleteOpen(false)}
          size="sm"
        >
          <DialogTitle>Delete video</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {video.title ?? "this video"}&rdquo;? This action cannot be undone.
          </DialogDescription>
          <DialogActions>
            <Button
              plain
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
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

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          {video.channelTitle && <span>{video.channelTitle}</span>}
          {video.channelTitle && video.durationSeconds && (
            <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
          )}
          {video.durationSeconds && (
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {formatTimestamp(video.durationSeconds)}
            </span>
          )}
          {video.status !== "ready" && (
            <Badge
              color={
                video.status === "failed"
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
          )}
        </div>

        {/* Processing progress */}
        {isProcessing && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
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

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5">
            {tags.map((tag, i) => (
              <span key={tag.id} className="inline-flex items-center gap-1.5">
                <Link
                  to={`/?tag=${encodeURIComponent(tag.slug)}`}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  {tag.name}
                </Link>
                {i < tags.length - 1 && (
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Error state */}
        {video.status === "failed" && (
          <div className="space-y-2">
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

      {/* Summary */}
      {video.summary && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <h2 className="shrink-0 px-4 pt-4 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Summary
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {video.summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
