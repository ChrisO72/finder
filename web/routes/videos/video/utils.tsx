export type Segment = {
  id: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type Chunk = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  segmentIds: number[];
};

export function groupSegments(segments: Segment[], windowSeconds = 30): Chunk[] {
  if (segments.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: Chunk = {
    startSeconds: segments[0].startSeconds,
    endSeconds: segments[0].endSeconds,
    text: segments[0].text,
    segmentIds: [segments[0].id],
  };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startSeconds - current.startSeconds < windowSeconds) {
      current.endSeconds = seg.endSeconds;
      current.text += " " + seg.text;
      current.segmentIds.push(seg.id);
    } else {
      chunks.push(current);
      current = {
        startSeconds: seg.startSeconds,
        endSeconds: seg.endSeconds,
        text: seg.text,
        segmentIds: [seg.id],
      };
    }
  }
  chunks.push(current);
  return chunks;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function highlightWords(
  text: string,
  query: string,
): React.ReactNode {
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(pattern);
  const checker = new RegExp(`^(?:${words.join("|")})$`, "i");
  return (
    <>
      {parts.map((part, i) =>
        checker.test(part) ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/30 dark:text-yellow-200"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
