// Read-only insight calls. Rendering never imports this. A refusal leaves the metric missing.
import { parseMediaInsights, type MediaInsights } from "./queue-insights";
import {
  dayKey,
  daysFromInsightPoints,
  insightPoints,
  optionalMetricNames,
  type DayDraft,
} from "./results";

const GRAPH = "https://graph.instagram.com/v19.0";

async function readMediaMetrics(
  accessToken: string,
  mediaId: string,
  names: readonly string[],
  request: typeof fetch,
): Promise<MediaInsights | null> {
  if (!names.length) return {};
  try {
    const params = new URLSearchParams({
      metric: names.join(","),
      access_token: accessToken,
    });
    const response = await request(`${GRAPH}/${mediaId}/insights?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || (data as { error?: unknown } | null)?.error) return null;
    return parseMediaInsights(data);
  } catch {
    return null;
  }
}

/** Metrics the media type may reject. A refusal is a missing key, never a zero. */
export async function fetchOptionalMediaMetrics(
  accessToken: string,
  mediaId: string,
  templateType: string | null,
  request: typeof fetch = fetch,
): Promise<MediaInsights> {
  if (!accessToken || !mediaId) return {};
  const names = optionalMetricNames(templateType);
  const batched = await readMediaMetrics(accessToken, mediaId, names, request);
  if (batched) return batched;
  const merged: MediaInsights = {};
  for (const name of names) {
    const one = await readMediaMetrics(accessToken, mediaId, [name], request);
    if (one) Object.assign(merged, one);
  }
  return merged;
}

const ACCOUNT_METRICS = [
  "reach",
  "views",
  "profile_views",
  "accounts_engaged",
  "website_clicks",
  "follower_count",
] as const;

async function readUserPoints(
  accessToken: string,
  igUserId: string,
  names: readonly string[],
  period: string,
  since: number | null,
  until: number | null,
  request: typeof fetch,
) {
  try {
    const params = new URLSearchParams({
      metric: names.join(","),
      period,
      access_token: accessToken,
    });
    if (since != null) params.set("since", String(since));
    if (until != null) params.set("until", String(until));
    const response = await request(`${GRAPH}/${igUserId}/insights?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || (data as { error?: unknown } | null)?.error) return null;
    return insightPoints(data);
  } catch {
    return null;
  }
}

export async function fetchInstagramAccountDaily(
  accessToken: string,
  igUserId: string,
  now: number,
  options: { demographics?: boolean; request?: typeof fetch } = {},
): Promise<DayDraft[]> {
  if (!accessToken || !igUserId) return [];
  const request = options.request ?? fetch;
  const until = Math.floor(now / 1000);
  const since = until - 7 * 86400;
  let points = await readUserPoints(accessToken, igUserId, ACCOUNT_METRICS, "day", since, until, request);
  if (!points) {
    points = [];
    for (const name of ACCOUNT_METRICS) {
      const one = await readUserPoints(accessToken, igUserId, [name], "day", since, until, request);
      if (one) points.push(...one);
    }
  }
  const online = await readUserPoints(accessToken, igUserId, ["online_followers"], "lifetime", null, null, request);
  if (online) points.push(...online);
  if (options.demographics) {
    const demo = await readUserPoints(
      accessToken,
      igUserId,
      ["follower_demographics"],
      "lifetime",
      null,
      null,
      request,
    );
    if (demo) points.push(...demo);
  }
  return daysFromInsightPoints(points, dayKey(now));
}
