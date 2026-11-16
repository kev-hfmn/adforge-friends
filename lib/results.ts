// Results math. No database and no network. Missing metrics stay missing.
import { type MediaInsights, type MediaMetric } from "./queue-insights";
import { localInput } from "./queue-schedule";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** Never read insights sooner than this. The schedule below can ask for hourly. */
export const INSIGHTS_MIN_GAP_MS = 6 * HOUR_MS;
export const COMPARE_REACH = 100;
export const MIN_SAMPLE = 3;
export const RESULT_WINDOW_DAYS = 28;

export function dayKey(at: number): string {
  return localInput(at).slice(0, 10);
}

export function shiftDay(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  return shiftDay(key, -((date.getUTCDay() + 6) % 7));
}

export function zoneParts(at: number): { day: string; hour: number; weekday: number } {
  const input = localInput(at);
  const day = input.slice(0, 10);
  return {
    day,
    hour: Number(input.slice(11, 13)),
    weekday: new Date(`${day}T12:00:00Z`).getUTCDay(),
  };
}

/** How often a snapshot is wanted. Null means stop (older than 90 days). */
export function snapshotCadenceMs(ageMs: number): number | null {
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;
  if (ageMs < 48 * HOUR_MS) return HOUR_MS;
  if (ageMs < 7 * DAY_MS) return DAY_MS;
  if (ageMs <= 90 * DAY_MS) return 7 * DAY_MS;
  return null;
}

/** Gap before the next stored reading. Hourly is raised to the 6 hour floor. */
export function snapshotGapMs(ageMs: number): number | null {
  const cadence = snapshotCadenceMs(ageMs);
  return cadence == null ? null : Math.max(cadence, INSIGHTS_MIN_GAP_MS);
}

export function snapshotDue(postedAt: number, lastTakenAt: number | null, now: number): boolean {
  if (!Number.isFinite(postedAt) || now < postedAt) return false;
  const gap = snapshotGapMs(now - postedAt);
  if (gap == null) return false;
  if (lastTakenAt == null) return true;
  return now - lastTakenAt >= gap;
}

export function optionalMetricNames(templateType: string | null): readonly MediaMetric[] {
  return templateType === "reel"
    ? ["follows", "profile_visits", "reels_skip_rate", "ig_reels_video_view_total_time"]
    : ["follows", "profile_visits"];
}

/** Keep known finite numbers. Do not invent a zero for a metric the payload omitted. */
export function cleanMetrics(input: object | null | undefined): MediaInsights {
  const source = (input ?? {}) as Record<string, unknown>;
  const metrics: MediaInsights = {};
  for (const key of Object.keys(source) as MediaMetric[]) {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    if (
      key === "reach" ||
      key === "likes" ||
      key === "comments" ||
      key === "saved" ||
      key === "shares" ||
      key === "total_interactions" ||
      key === "views" ||
      key === "follows" ||
      key === "profile_visits" ||
      key === "reels_skip_rate" ||
      key === "ig_reels_avg_watch_time" ||
      key === "ig_reels_video_view_total_time"
    )
      metrics[key] = value;
  }
  return metrics;
}

export function perReach(part: number | undefined, reach: number | undefined): number | null {
  if (typeof part !== "number" || typeof reach !== "number") return null;
  if (!Number.isFinite(part) || !Number.isFinite(reach) || reach <= 0) return null;
  return part / reach;
}

export function perHundredLabel(ratio: number | null, reach: number | null | undefined): string {
  if (reach == null) return "n/a";
  if (reach < COMPARE_REACH) return "too few";
  if (ratio == null) return "n/a";
  const per = ratio * 100;
  const rounded = per >= 10 ? String(Math.round(per)) : per.toFixed(1);
  return `${rounded} per 100`;
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function sumDefined(values: readonly (number | null | undefined)[]): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return nums.length ? nums.reduce((total, value) => total + value, 0) : null;
}

export type CountPair = { current: number | null; previous: number | null };

export function compareCount(label: string, pair: CountPair): { text: string; tooFew: boolean } {
  const { current, previous } = pair;
  if (current == null) return { text: `${label}: no number yet.`, tooFew: false };
  const shown = current.toLocaleString("en-GB");
  if (previous == null) return { text: `${label} ${shown}. No earlier week to compare.`, tooFew: current < COMPARE_REACH };
  if (current === previous) {
    return {
      text: `${label} ${shown}, same as last week.`,
      tooFew: current < COMPARE_REACH || previous < COMPARE_REACH,
    };
  }
  const direction = current > previous ? "up from" : "down from";
  const tooFew = current < COMPARE_REACH || previous < COMPARE_REACH || previous === 0;
  const text = `${label} ${shown}, ${direction} ${previous.toLocaleString("en-GB")} last week.`;
  if (tooFew) return { text, tooFew: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  const word = pct >= 0 ? "Up" : "Down";
  return { text: `${text} ${word} ${Math.abs(pct)} percent.`, tooFew: false };
}

export function onlineFollowersFrom(value: unknown): Record<string, number> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item) && item >= 0) out[key] = item;
  }
  return Object.keys(out).length ? out : null;
}

type InsightEntry = {
  name?: unknown;
  values?: { value?: unknown; end_time?: unknown }[];
  total_value?: { value?: unknown };
};

export function insightPoints(payload: unknown): { name: string; at: string | null; value: unknown }[] {
  const data = payload != null && typeof payload === "object" ? (payload as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  const points: { name: string; at: string | null; value: unknown }[] = [];
  for (const entry of data) {
    if (entry == null || typeof entry !== "object") continue;
    const row = entry as InsightEntry;
    if (typeof row.name !== "string") continue;
    if (Array.isArray(row.values) && row.values.length) {
      for (const item of row.values) {
        points.push({
          name: row.name,
          at: typeof item?.end_time === "string" ? item.end_time : null,
          value: item?.value,
        });
      }
    } else if (row.total_value && "value" in row.total_value) {
      points.push({ name: row.name, at: null, value: row.total_value.value });
    }
  }
  return points;
}

export type DayDraft = {
  day: string;
  followers: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
  websiteTaps: number | null;
  onlineFollowers: Record<string, number> | null;
  demographics: unknown | null;
};

const FIELD_BY_NAME: Record<string, keyof DayDraft> = {
  reach: "reach",
  views: "views",
  profile_views: "profileViews",
  accounts_engaged: "accountsEngaged",
  website_clicks: "websiteTaps",
  follower_count: "followers",
  page_follows: "followers",
  page_impressions_unique: "reach",
  page_media_view: "views",
  page_views_total: "profileViews",
  page_post_engagements: "accountsEngaged",
  page_website_clicks: "websiteTaps",
};

export function daysFromInsightPoints(
  points: readonly { name: string; at: string | null; value: unknown }[],
  fallbackDay: string,
): DayDraft[] {
  const byDay = new Map<string, DayDraft>();
  const blank = (day: string): DayDraft => ({
    day,
    followers: null,
    reach: null,
    views: null,
    profileViews: null,
    accountsEngaged: null,
    websiteTaps: null,
    onlineFollowers: null,
    demographics: null,
  });
  for (const point of points) {
    const day = point.at != null && Number.isFinite(Date.parse(point.at)) ? dayKey(Date.parse(point.at)) : fallbackDay;
    const row = byDay.get(day) ?? blank(day);
    if (point.name === "online_followers") {
      const online = onlineFollowersFrom(point.value);
      if (online) row.onlineFollowers = online;
    } else if (point.name === "follower_demographics" || point.name === "engaged_audience_demographics") {
      if (point.value != null && typeof point.value === "object") row.demographics = point.value;
    } else {
      const field = FIELD_BY_NAME[point.name];
      if (field && field !== "day" && field !== "onlineFollowers" && field !== "demographics") {
        if (typeof point.value === "number" && Number.isFinite(point.value) && point.value >= 0)
          (row[field] as number | null) = point.value;
      }
    }
    byDay.set(day, row);
  }
  return [...byDay.values()].filter((row) => dayHasNumber(row));
}

export function dayHasNumber(row: DayDraft): boolean {
  return (
    row.followers != null ||
    row.reach != null ||
    row.views != null ||
    row.profileViews != null ||
    row.accountsEngaged != null ||
    row.websiteTaps != null ||
    row.onlineFollowers != null ||
    row.demographics != null
  );
}

export function facebookPostMetrics(values: Record<string, number | undefined>): MediaInsights {
  const metrics: MediaInsights = {};
  if (typeof values.post_impressions_unique === "number") metrics.reach = values.post_impressions_unique;
  if (typeof values.post_impressions === "number") metrics.views = values.post_impressions;
  if (typeof values.post_clicks === "number") metrics.total_interactions = values.post_clicks;
  return cleanMetrics(metrics);
}

export function snapshotsToWrite(
  posts: readonly { id: string; postedAt: number; channel: string; metrics: MediaInsights }[],
  lastTaken: ReadonlyMap<string, number | null>,
  now: number,
): { id: string; channel: string; metrics: MediaInsights }[] {
  return posts.filter((post) => {
    if (!Object.keys(post.metrics).length) return false;
    return snapshotDue(post.postedAt, lastTaken.get(`${post.id}:${post.channel}`) ?? null, now);
  });
}

