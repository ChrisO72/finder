const TAG_COLORS = [
  // Indigo
  "bg-indigo-100/80 text-indigo-700 hover:bg-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25",
  // Lagoon
  "bg-sky-100/80 text-sky-700 hover:bg-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25",
  // Jade
  "bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25",
  // Flamingo
  "bg-rose-100/80 text-rose-700 hover:bg-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25",
  // Grass
  "bg-lime-100/80 text-lime-700 hover:bg-lime-200/80 dark:bg-lime-500/15 dark:text-lime-300 dark:hover:bg-lime-500/25",
  // Slate
  "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80 dark:bg-zinc-500/15 dark:text-zinc-300 dark:hover:bg-zinc-500/25",
  // Aubergine
  "bg-purple-100/80 text-purple-700 hover:bg-purple-200/80 dark:bg-purple-500/15 dark:text-purple-300 dark:hover:bg-purple-500/25",
  // Honeycomb
  "bg-amber-100/80 text-amber-700 hover:bg-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25",
  // Horchata
  "bg-orange-100/70 text-orange-800 hover:bg-orange-200/70 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/25",
  // Cobalt
  "bg-blue-100/80 text-blue-700 hover:bg-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25",
  // Fuchsia
  "bg-fuchsia-100/80 text-fuchsia-700 hover:bg-fuchsia-200/80 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/25",
  // Teal
  "bg-teal-100/80 text-teal-700 hover:bg-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:hover:bg-teal-500/25",
  // Coral
  "bg-red-100/70 text-red-700 hover:bg-red-200/70 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25",
  // Cyan
  "bg-cyan-100/80 text-cyan-700 hover:bg-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-300 dark:hover:bg-cyan-500/25",
  // Violet
  "bg-violet-100/80 text-violet-700 hover:bg-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25",
  // Marigold
  "bg-yellow-100/80 text-yellow-700 hover:bg-yellow-200/80 dark:bg-yellow-500/15 dark:text-yellow-300 dark:hover:bg-yellow-500/25",
  // Pink
  "bg-pink-100/80 text-pink-700 hover:bg-pink-200/80 dark:bg-pink-500/15 dark:text-pink-300 dark:hover:bg-pink-500/25",
  // Green
  "bg-green-100/80 text-green-700 hover:bg-green-200/80 dark:bg-green-500/15 dark:text-green-300 dark:hover:bg-green-500/25",
] as const;

export function getTagColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
