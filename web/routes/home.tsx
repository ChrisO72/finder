import { Form, Link, useLoaderData, useNavigation } from "react-router";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { PlayCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { requireAuth } from "~/lib/session.server";
import { getUserById } from "~/db/repositories/users";
import { searchSegments, type SearchResult } from "~/db/repositories/segments";
import { recentVideosByOrg } from "~/db/repositories/videos";
import { Heading } from "~/components/ui-kit/heading";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Finder" },
    { name: "description", content: "Search across your video library" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuth(request);
  const user = await getUserById(auth.userId);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  let results: SearchResult[] = [];
  if (query) {
    results = await searchSegments(query, user.organizationId);
  }

  const recentVideos = query
    ? []
    : await recentVideosByOrg(user.organizationId, 8);

  return { query, results, recentVideos };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  return formatTimestamp(seconds);
}

export default function Home() {
  const { query, results, recentVideos } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSearching =
    navigation.state === "loading" &&
    new URLSearchParams(navigation.location?.search).has("q");

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-10 text-center">
        <Heading className="text-3xl! mb-2">Search your videos</Heading>
        <p className="text-zinc-500 dark:text-zinc-400">
          Find any moment across your entire library
        </p>
      </div>

      <Form method="get" className="relative mb-10">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search transcripts..."
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-12 pr-4 text-base shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
        />
      </Form>

      {isSearching && (
        <div className="py-12 text-center text-zinc-500">Searching...</div>
      )}

      {!isSearching && query && results.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {results.length} result{results.length !== 1 ? "s" : ""} for
            &ldquo;{query}&rdquo;
          </p>
          {results.map((r) => (
            <Link
              key={r.segmentId}
              to={`/videos/${r.videoId}?t=${Math.floor(r.startSeconds)}`}
              className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {r.videoTitle ?? "Untitled"}
                </span>
                {r.channelTitle && (
                  <span className="text-xs text-zinc-500">{r.channelTitle}</span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                  <PlayCircleIcon className="size-3.5" />
                  {formatTimestamp(r.startSeconds)}
                </span>
                <p
                  className="text-sm text-zinc-600 dark:text-zinc-300 [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 dark:[&_mark]:bg-yellow-500/30 dark:[&_mark]:text-yellow-200"
                  dangerouslySetInnerHTML={{ __html: r.headline }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {!query && recentVideos.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Recent videos
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recentVideos.map((v) => (
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

      {!query && recentVideos.length === 0 && (
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
