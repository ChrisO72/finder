import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { PlayCircleIcon, ClockIcon, TagIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import {
  searchSegments,
  hybridSearch,
  type HybridResult,
} from "~/db/repositories/segments";
import {
  getTagsByOrganization,
  getVideosByTag,
  getTagsForVideoIds,
  type TagWithCount,
} from "~/db/repositories/tags";
import { Heading } from "~/components/ui-kit/heading";
import { getTagColorClass } from "~/lib/tag-colors";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Finder" },
    { name: "description", content: "Search across your video library" },
  ];
}

type SearchMode = "hybrid" | "exact";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const mode: SearchMode =
    url.searchParams.get("mode") === "exact" ? "exact" : "hybrid";
  const tagSlug = url.searchParams.get("tag")?.trim() ?? "";

  let results: HybridResult[] = [];

  if (query) {
    if (mode === "exact") {
      const kwResults = await searchSegments(
        query,
        user.organizationId,
        20,
        tagSlug || undefined,
      );
      results = kwResults.map((r, i) => ({
        videoId: r.videoId,
        text: r.text,
        headline: r.headline,
        startSeconds: r.startSeconds,
        endSeconds: r.endSeconds,
        score: r.rank,
        videoTitle: r.videoTitle,
        youtubeVideoId: r.youtubeVideoId,
        thumbnailUrl: r.thumbnailUrl,
        channelTitle: r.channelTitle,
        source: "keyword" as const,
        segmentId: r.segmentId,
      }));
    } else {
      results = await hybridSearch(
        query,
        user.organizationId,
        20,
        tagSlug || undefined,
      );
    }
  }

  const allTags = await getTagsByOrganization(user.organizationId);

  let videoTagsMap: Record<number, { id: number; name: string; slug: string }[]> = {};
  let resultTags: { id: number; name: string; slug: string }[] = [];

  if (results.length > 0) {
    const videoIds = [...new Set(results.map((r) => r.videoId))];
    videoTagsMap = await getTagsForVideoIds(videoIds);

    const seen = new Set<number>();
    for (const tags of Object.values(videoTagsMap)) {
      for (const t of tags) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          resultTags.push(t);
        }
      }
    }
    resultTags.sort((a, b) => a.name.localeCompare(b.name));
  }

  type TagVideo = {
    id: number;
    title: string | null;
    channelTitle: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    youtubeVideoId: string;
  };
  let tagVideos: TagVideo[] = [];
  let activeTag: TagWithCount | null = null;

  if (tagSlug && !query) {
    tagVideos = await getVideosByTag(tagSlug, user.organizationId);
    activeTag = allTags.find((t) => t.slug === tagSlug) ?? null;
  }

  return {
    query,
    mode,
    results,
    allTags,
    tagSlug,
    tagVideos,
    activeTag,
    videoTagsMap,
    resultTags,
  };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  return formatTimestamp(seconds);
}

export default function Home() {
  const {
    query,
    mode,
    results,
    allTags,
    tagSlug,
    tagVideos,
    activeTag,
    videoTagsMap,
    resultTags,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSearching =
    navigation.state === "loading" &&
    new URLSearchParams(navigation.location?.search).has("q");

  const hasResults = results.length > 0;
  const resultCount = results.length;

  const exactToggleParams = new URLSearchParams();
  if (query) exactToggleParams.set("q", query);
  if (tagSlug) exactToggleParams.set("tag", tagSlug);
  if (mode !== "exact") exactToggleParams.set("mode", "exact");

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-10 text-center">
        <Heading className="text-3xl! mb-2">Search your videos</Heading>
        <p className="text-zinc-500 dark:text-zinc-400">
          Find any moment across your entire library
        </p>
      </div>

      <Form method="get" className="relative mb-1.5">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search videos, topics, keywords, questions..."
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-12 pr-4 text-base shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
        />
        {mode === "exact" && <input type="hidden" name="mode" value="exact" />}
        {tagSlug && <input type="hidden" name="tag" value={tagSlug} />}
      </Form>

      <div className="mb-6 flex justify-end">
        <Link
          to={`/?${exactToggleParams.toString()}`}
          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition ${mode === "exact"
            ? "text-blue-700 dark:text-blue-400"
            : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
        >
          <span
            className={`flex size-3.5 items-center justify-center rounded border transition ${mode === "exact"
              ? "border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400"
              : "border-zinc-300 dark:border-zinc-600"
              }`}
          >
            {mode === "exact" && (
              <svg className="size-2.5 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          Exact match only
        </Link>
      </div>

      {tagSlug && activeTag && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Filtering by
          </span>
          <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-medium ${getTagColorClass(activeTag.name)}`}>
            {activeTag.name}
            <Link
              to={query ? `/?q=${encodeURIComponent(query)}&mode=${mode}` : "/"}
              className="ml-1 rounded-full p-0.5 opacity-70 hover:opacity-100"
            >
              <XMarkIcon className="size-3.5" />
            </Link>
          </span>
        </div>
      )}

      {isSearching && (
        <div className="py-12 text-center text-zinc-500">Searching...</div>
      )}

      {!isSearching && query && !hasResults && (
        <div className="py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {!isSearching && hasResults && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {resultCount} result{resultCount !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>

          {resultTags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Filter by tag:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {resultTags.map((tag) => {
                  const isActive = tagSlug === tag.slug;
                  const params = new URLSearchParams();
                  params.set("q", query);
                  if (mode === "exact") params.set("mode", "exact");
                  if (!isActive) params.set("tag", tag.slug);
                  return (
                    <Link
                      key={tag.id}
                      to={`/?${params.toString()}`}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? `ring-2 ring-blue-500 dark:ring-blue-400 ${getTagColorClass(tag.name)}`
                          : getTagColorClass(tag.name)
                      }`}
                    >
                      {tag.name}
                      {isActive && <XMarkIcon className="size-3" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {results.map((r, i) => {
            const isSummaryResult = r.segmentId === null && r.startSeconds === 0 && r.endSeconds === 0;
            const linkUrl = isSummaryResult
              ? `/videos/${r.videoId}?q=${encodeURIComponent(query)}`
              : r.segmentId
                ? `/videos/${r.videoId}?t=${Math.floor(r.startSeconds)}&q=${encodeURIComponent(query)}&mode=keyword&sid=${r.segmentId}`
                : `/videos/${r.videoId}?t=${Math.floor(r.startSeconds)}&q=${encodeURIComponent(query)}&mode=semantic&from=${Math.floor(r.startSeconds)}&to=${Math.ceil(r.endSeconds)}`;

            const tags = videoTagsMap[r.videoId] ?? [];
            const visibleTags = tags.slice(0, 2);
            const overflowCount = tags.length - visibleTags.length;
            return (
              <Link
                key={`${r.videoId}-${r.startSeconds}-${i}`}
                to={linkUrl}
                className="flex overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
              >
                {r.thumbnailUrl ? (
                  <img
                    src={r.thumbnailUrl}
                    alt=""
                    className="hidden sm:block w-44 shrink-0 object-cover"
                  />
                ) : (
                  <div className="hidden sm:flex w-44 shrink-0 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                    <PlayCircleIcon className="size-8 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      {r.videoTitle ?? "Untitled"}
                    </span>
                    {visibleTags.length > 0 && (
                      <span className="shrink-0 truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {visibleTags.map((t) => t.name).join(", ")}
                        {overflowCount > 0 && ` +${overflowCount}`}
                      </span>
                    )}
                  </div>
                  <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {r.channelTitle ?? "\u00A0"}
                  </p>
                  <div className="mb-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Source</span>
                      {isSummaryResult ? (
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">
                          <DocumentTextIcon className="size-3.5" />
                          Summary
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                          <PlayCircleIcon className="size-3.5" />
                          {r.source === "keyword"
                            ? formatTimestamp(r.startSeconds)
                            : `${formatTimestamp(r.startSeconds)} – ${formatTimestamp(r.endSeconds)}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Match</span>
                      <SourceBadges source={r.source} />
                    </div>
                  </div>
                  {r.headline ? (
                    <p
                      className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300 [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 dark:[&_mark]:bg-yellow-500/30 dark:[&_mark]:text-yellow-200"
                      dangerouslySetInnerHTML={{ __html: r.headline }}
                    />
                  ) : (
                    <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">
                      {r.text}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!query && !tagSlug && allTags.length > 0 && (
        <div>
          <h2 className="mb-5 text-lg font-semibold text-zinc-900 dark:text-white">
            Browse by topic
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {allTags.slice(0, 10).map((tag) => (
              <Link
                key={tag.id}
                to={`/?tag=${encodeURIComponent(tag.slug)}`}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-center shadow-sm transition hover:shadow-md ${getTagColorClass(tag.name)}`}
              >
                <span className="w-full break-words px-2 text-center text-base font-medium capitalize">{tag.name}</span>
                <span className="mt-1 text-xs opacity-50">
                  {tag.videoCount} video{tag.videoCount !== 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!query && tagSlug && tagVideos.length > 0 && (
        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tagVideos.map((v) => (
              <Link
                key={v.id}
                to={`/videos/${v.id}`}
                className="group overflow-hidden rounded-lg border border-zinc-200 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:hover:border-zinc-600"
              >
                {v.thumbnailUrl ? (
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title ?? ""}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                    <PlayCircleIcon className="size-10 text-zinc-400" />
                  </div>
                )}
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-zinc-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {v.title ?? "Untitled"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    {v.channelTitle && <span>{v.channelTitle}</span>}
                    {v.durationSeconds && (
                      <span className="flex items-center gap-0.5">
                        <ClockIcon className="size-3" />
                        {formatDuration(v.durationSeconds)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!query && tagSlug && tagVideos.length === 0 && (
        <div className="py-12 text-center">
          <TagIcon className="mx-auto mb-3 size-12 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No videos with this tag.{" "}
            <Link
              to="/"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Browse all tags
            </Link>
          </p>
        </div>
      )}

      {!query && !tagSlug && allTags.length === 0 && (
        <div className="py-12 text-center">
          <PlayCircleIcon className="mx-auto mb-3 size-12 text-zinc-300 dark:text-zinc-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No videos yet.{" "}
            <Link
              to="/videos"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Add your first video
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function SourceBadges({ source }: { source: "keyword" | "semantic" | "both" }) {
  return (
    <span className="flex items-center gap-1">
      {(source === "keyword" || source === "both") && (
        <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Keyword
        </span>
      )}
      {(source === "semantic" || source === "both") && (
        <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
          Semantic
        </span>
      )}
    </span>
  );
}
