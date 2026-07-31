import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { Link, Form, useNavigation } from "react-router";
import { Heading } from "~/components/ui-kit/heading";
import { searchSegments } from "~/db/repositories/segments";
import {
  getEpisodesByTag,
  getTagsByOrganization,
  getTagsForEpisodeIds,
} from "~/db/repositories/tags";
import { hybridSearch, type HybridResult } from "~/lib/search.server";
import { getAuthenticatedUser } from "~/lib/session.server";
import type { Route } from "./+types/search";

type SearchMode = "hybrid" | "exact";

export function meta() {
  return [{ title: "Search · Finder" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = getAuthenticatedUser(context);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const mode: SearchMode = url.searchParams.get("mode") === "exact" ? "exact" : "hybrid";
  const tagSlug = url.searchParams.get("tag")?.trim() ?? "";

  let results: HybridResult[] = [];
  if (query) {
    if (mode === "exact") {
      const exactResults = await searchSegments(
        query,
        user.organizationId,
        20,
        tagSlug || undefined,
      );
      results = exactResults.map((result) => ({
        episodeId: result.episodeId,
        text: result.text,
        headline: result.headline,
        startSeconds: result.startSeconds,
        endSeconds: result.endSeconds,
        score: result.rank,
        episodeTitle: result.episodeTitle,
        artworkUrl: result.artworkUrl,
        podcastTitle: result.podcastTitle,
        source: "keyword" as const,
        segmentId: result.segmentId,
      }));
    } else {
      results = await hybridSearch(query, user.organizationId, 20, tagSlug || undefined);
    }
  }

  const allTags = await getTagsByOrganization(user.organizationId);
  const episodeIds = [...new Set(results.map((result) => result.episodeId))];
  const episodeTags = await getTagsForEpisodeIds(episodeIds);
  const tagEpisodes = tagSlug && !query ? await getEpisodesByTag(tagSlug, user.organizationId) : [];

  return {
    query,
    mode,
    tagSlug,
    results,
    allTags,
    episodeTags,
    tagEpisodes,
  };
}

export default function AdminSearch({ loaderData }: Route.ComponentProps) {
  const { query, mode, tagSlug, results, allTags, episodeTags, tagEpisodes } = loaderData;
  const navigation = useNavigation();
  const isSearching =
    navigation.state === "loading" && new URLSearchParams(navigation.location?.search).has("q");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <Heading>Search the archive</Heading>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Find a moment across every processed episode.
        </p>
      </div>

      <Form method="get" className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search words, ideas, or questions"
          className="w-full rounded-xl border border-zinc-200 bg-white py-3.5 pr-4 pl-12 text-base shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-950/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500"
        />
        {mode === "exact" && <input type="hidden" name="mode" value="exact" />}
        {tagSlug && <input type="hidden" name="tag" value={tagSlug} />}
      </Form>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
          {allTags.map((tag) => (
            <Link
              key={tag.id}
              to={tag.slug === tagSlug ? "/admin" : `/admin?tag=${encodeURIComponent(tag.slug)}`}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                tag.slug === tagSlug
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {tag.name} · {tag.episodeCount}
            </Link>
          ))}
        </div>
        <Link
          to={
            mode === "exact"
              ? searchUrl(query, tagSlug, "hybrid")
              : searchUrl(query, tagSlug, "exact")
          }
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
        >
          {mode === "exact" ? "Use semantic search" : "Exact words only"}
        </Link>
      </div>

      <div className="mt-8">
        {isSearching ? (
          <p className="py-12 text-center text-sm text-zinc-500">Searching…</p>
        ) : query && results.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No matching moments.</p>
        ) : results.length > 0 ? (
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((result, index) => (
              <SearchResultRow
                key={`${result.episodeId}-${result.startSeconds}-${index}`}
                result={result}
                query={query}
                tags={episodeTags[result.episodeId] ?? []}
              />
            ))}
          </div>
        ) : tagEpisodes.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {tagEpisodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/admin/episodes/${episode.id}`}
                className="flex gap-3 rounded-xl border border-zinc-200 p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <Artwork src={episode.artworkUrl} title={episode.title} />
                <div className="min-w-0 self-center">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                    {episode.title}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{episode.podcastTitle}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">The archive is quiet.</p>
            <Link
              to="/admin/episodes"
              className="mt-2 inline-block text-sm font-medium text-zinc-950 underline dark:text-white"
            >
              Add a Buzzsprout feed
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultRow({
  result,
  query,
  tags,
}: {
  result: HybridResult;
  query: string;
  tags: { id: number; name: string; slug: string }[];
}) {
  const isSummary =
    result.segmentId === null && result.startSeconds === 0 && result.endSeconds === 0;
  const params = new URLSearchParams({ q: query });
  if (!isSummary) params.set("t", String(Math.floor(result.startSeconds)));

  return (
    <Link
      to={`/admin/episodes/${result.episodeId}?${params.toString()}`}
      className="flex gap-4 py-5 transition hover:opacity-70"
    >
      <Artwork src={result.artworkUrl} title={result.episodeTitle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
            {result.episodeTitle}
          </p>
          {!isSummary && (
            <span className="shrink-0 text-xs text-zinc-400 tabular-nums">
              {formatTimestamp(result.startSeconds)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{result.podcastTitle}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {result.text}
        </p>
        {tags.length > 0 && (
          <p className="mt-2 truncate text-xs text-zinc-400">
            {tags.map((tag) => tag.name).join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );
}

function Artwork({ src, title }: { src: string | null; title: string }) {
  return src ? (
    <img src={src} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
  ) : (
    <div aria-label={title} className="size-16 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
  );
}

function searchUrl(query: string, tagSlug: string, mode: SearchMode) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tagSlug) params.set("tag", tagSlug);
  if (mode === "exact") params.set("mode", "exact");
  const search = params.toString();
  return search ? `/admin?${search}` : "/admin";
}

function formatTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
