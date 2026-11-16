export const MEDIA_METRICS = [
  "reach",
  "likes",
  "comments",
  "saved",
  "shares",
  "total_interactions",
  "views",
  "follows",
  "profile_visits",
  "reels_skip_rate",
  "ig_reels_avg_watch_time", // reels only, milliseconds
  "ig_reels_video_view_total_time", // reels only, milliseconds
] as const;
export type MediaMetric = (typeof MEDIA_METRICS)[number];
export type MediaInsights = Partial<Record<MediaMetric, number>>;
export type AccountStats = {
  followers: number | null;
  mediaCount: number | null;
};
export type StoredInsights = {
  metrics: MediaInsights;
  account?: AccountStats;
  accountUpdatedAt?: number;
  accountError?: string;
  accountPermissionError?: boolean;
  error?: string;
  permissionError?: boolean;
};
function object(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
export function parseMediaInsights(payload: unknown): MediaInsights {
  const metrics: MediaInsights = {};
  const rows = object(payload).data;
  if (!Array.isArray(rows)) return metrics;
  for (const entry of rows) {
    const row = object(entry);
    if (!MEDIA_METRICS.includes(row.name as MediaMetric)) continue;
    const values = row.values;
    const first = Array.isArray(values) ? object(values[0]).value : undefined;
    const value = object(row.total_value).value ?? first;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      metrics[row.name as MediaMetric] = value;
  }
  return metrics;
}
export function storedInsights(json: string | null): StoredInsights {
  try {
    const parsed = object(JSON.parse(json ?? "{}"));
    return { ...parsed, metrics: object(parsed.metrics) as MediaInsights };
  } catch {
    return { metrics: {} };
  }
}
export function needsInsights(
  post: {
    status: string | null;
    postedAt: number | null;
    igMediaId: string | null;
    insightsUpdatedAt: number | null;
  },
  now: number,
) {
  return (
    post.status === "posted" &&
    !!post.igMediaId &&
    post.postedAt != null &&
    post.postedAt >= now - 30 * 86400000 &&
    (post.insightsUpdatedAt == null ||
      post.insightsUpdatedAt <= now - 6 * 3600000)
  );
}
export function insightsPermissionError(error: {
  code?: number;
  message?: string;
}): boolean {
  return (
    error.code === 10 ||
    error.code === 200 ||
    /permission|scope|manage_insights/i.test(error.message ?? "")
  );
}
export function parseAccountStats(payload: unknown): AccountStats {
  const value = object(payload);
  return {
    followers:
      typeof value.followers_count === "number" ? value.followers_count : null,
    mediaCount:
      typeof value.media_count === "number" ? value.media_count : null,
  };
}

/** Average watch time as Instagram reports it (milliseconds), shown as seconds: "9.4s". */
export function formatWatchTime(ms: number | undefined): string | null {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0
    ? `${(ms / 1000).toFixed(1)}s`
    : null;
}
/** The numbers the owner and Claude look at, in one order, for rows, the sheet and Home. */
export function headlineNumbers(
  metrics: MediaInsights,
  reel: boolean,
): { label: string; value: string }[] {
  const n = (value: number | undefined) => value?.toLocaleString() ?? "n/a";
  return [
    { label: "Reach", value: n(metrics.reach) },
    { label: "Views", value: n(metrics.views) },
    { label: "Saves", value: n(metrics.saved) },
    { label: "Shares", value: n(metrics.shares) },
    ...(reel
      ? [
          {
            label: "Avg watch",
            value: formatWatchTime(metrics.ig_reels_avg_watch_time) ?? "n/a",
          },
        ]
      : []),
  ];
}
