import { db, sqlite } from "./db";
import { generatedPosts, postPublications, socialChannels } from "@/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { readFacebookPageDaily, readFacebookPostMetrics } from "./facebook";
import { fetchAccountStats, fetchMediaInsights } from "./instagram";
import {
  parseMediaInsights,
  storedInsights,
  type AccountStats,
  type MediaInsights,
} from "./queue-insights";
import { connectionState, facebookConnected, targetChannel } from "./queue-view";
import { fetchInstagramAccountDaily, fetchOptionalMediaMetrics } from "./results-fetch";
import {
  DAY_MS,
  dayKey,
  daysFromInsightPoints,
  facebookPostMetrics,
  snapshotDue,
} from "./results";
import {
  accountDayFresh,
  latestSnapshotMap,
  recordStoredSnapshots,
  writeAccountDays,
  writeSnapshot,
} from "./results-store";

let refreshing = false;
export async function refreshPublishedInsights(
  projectId?: string,
  manual = false,
) {
  if (refreshing)
    return { refreshed: 0, message: "Stats refresh already running" };
  refreshing = true;
  try {
    const now = Date.now();
    const channels = await db.query.socialChannels.findMany({
      where: projectId ? eq(socialChannels.projectId, projectId) : undefined,
    });
    let refreshed = 0,
      accounts = 0,
      message = "Stats are up to date";
    for (const channel of channels.filter(
      (ch) => ch.platform === "instagram",
    )) {
      if (
        !connectionState(channel, now).active ||
        !channel.projectId ||
        !channel.accessToken
      ) {
        if (channel.projectId) {
          const saved = recordStoredSnapshots(sqlite, channel.projectId, now);
          message =
            saved.snapshots || saved.days
              ? `Saved ${saved.snapshots} stored readings. Instagram is not connected, so nothing was fetched.`
              : "Publishing and stats are paused. Reconnect Instagram.";
        } else message = "Publishing and stats are paused. Reconnect Instagram.";
        continue;
      }
      const posts = (await db.query.generatedPosts.findMany({
        where: and(
          eq(generatedPosts.projectId, channel.projectId),
          eq(generatedPosts.status, "posted"),
        ),
        orderBy: [desc(generatedPosts.postedAt)],
      })).filter((p) => targetChannel(p) === "instagram"); // Facebook-only posts have no Instagram stats
      const anchor = posts[0];
      if (!anchor) {
        message =
          "Account stats will be available after the first published post.";
        continue;
      }
      const lastSnap = latestSnapshotMap(sqlite, channel.projectId);
      const due = posts.filter((p) => {
        if (!p.igMediaId || p.postedAt == null || p.postedAt < now - 90 * DAY_MS) return false;
        return manual || snapshotDue(p.postedAt, lastSnap.get(`${p.id}:instagram`) ?? null, now);
      });
      const cache = storedInsights(anchor.insightsJson);
      const accountDue =
        manual ||
        cache.accountUpdatedAt == null ||
        cache.accountUpdatedAt <= now - 6 * 3600000;
      if (!due.length && !accountDue) continue;
      let account: AccountStats | undefined,
        accountError: string | undefined,
        accountPermissionError = false;
      if (accountDue) {
        try {
          account = await fetchAccountStats(channel.accessToken);
          accounts++;
        } catch (error) {
          accountError =
            error instanceof Error ? error.message : "Account stats failed";
          accountPermissionError = !!(error as { permissionError?: boolean })
            .permissionError;
          message = accountError;
        }
      }
      for (const post of due) {
        const previous = storedInsights(post.insightsJson);
        try {
          const metrics = {
            ...(await fetchMediaInsights(channel.accessToken, post.igMediaId!)),
            ...(post.templateType === "reel"
              ? await fetchReelWatchTime(channel.accessToken, post.igMediaId!)
              : {}),
            ...(await fetchOptionalMediaMetrics(
              channel.accessToken,
              post.igMediaId!,
              post.templateType,
            )),
          };
          await db
            .update(generatedPosts)
            .set({
              insightsJson: JSON.stringify({
                ...previous,
                metrics,
                error: undefined,
                permissionError: false,
              }),
              insightsUpdatedAt: now,
            })
            .where(eq(generatedPosts.id, post.id));
          if (
            post.postedAt != null &&
            snapshotDue(post.postedAt, lastSnap.get(`${post.id}:instagram`) ?? null, now)
          ) {
            writeSnapshot(sqlite, channel.projectId, post.id, "instagram", now, metrics);
            lastSnap.set(`${post.id}:instagram`, now);
          }
          refreshed++;
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : "Stats failed";
          await db
            .update(generatedPosts)
            .set({
              insightsJson: JSON.stringify({
                ...previous,
                error: reason,
                permissionError: !!(error as { permissionError?: boolean })
                  .permissionError,
              }),
              insightsUpdatedAt: now,
            })
            .where(eq(generatedPosts.id, post.id));
          message = reason;
        }
      }
      if (accountDue) {
        const current = await db.query.generatedPosts.findFirst({
          where: eq(generatedPosts.id, anchor.id),
        });
        const latest = storedInsights(current?.insightsJson ?? null);
        // Account cache lives with the newest published post, even if it is older
        // than 30 days. Media insights are still fetched only within that window.
        await db
          .update(generatedPosts)
          .set({
            insightsJson: JSON.stringify({
              ...latest,
              account: account ?? latest.account,
              accountUpdatedAt: now,
              accountError,
              accountPermissionError,
            }),
          })
          .where(eq(generatedPosts.id, anchor.id));
        if (channel.igUserId) {
          try {
            const demo = sqlite
              .prepare(
                `SELECT 1 AS ok FROM account_daily
                 WHERE project_id = ? AND channel = 'instagram' AND demographics IS NOT NULL AND updated_at >= ?`,
              )
              .get(channel.projectId, now - 7 * DAY_MS);
            const days = await fetchInstagramAccountDaily(
              channel.accessToken,
              channel.igUserId,
              now,
              { demographics: !demo },
            );
            if (account?.followers != null) {
              const today = dayKey(now);
              const row = days.find((day) => day.day === today);
              if (row) row.followers = account.followers;
              else
                days.push({
                  day: today,
                  followers: account.followers,
                  reach: null,
                  views: null,
                  profileViews: null,
                  accountsEngaged: null,
                  websiteTaps: null,
                  onlineFollowers: null,
                  demographics: null,
                });
            }
            writeAccountDays(sqlite, channel.projectId, "instagram", days, now, manual);
          } catch {
            // A refused account series leaves the stored day as it is.
          }
        }
      }
    }
    for (const channel of channels.filter((ch) => ch.platform === "facebook" && ch.projectId)) {
      if (!facebookConnected(channel) || !channel.accessToken || !channel.accountId || !channel.projectId) continue;
      const owner = channel.projectId;
      if (manual || !accountDayFresh(sqlite, owner, "facebook", now)) {
        try {
          const values = await readFacebookPageDaily(channel.accountId, channel.accessToken);
          const points = Object.entries(values).map(([name, value]) => ({ name, at: null, value }));
          writeAccountDays(sqlite, owner, "facebook", daysFromInsightPoints(points, dayKey(now)), now, manual);
        } catch {
          // Blank or refused Page insights stay empty.
        }
      }
      const pubs = await db.query.postPublications.findMany({
        where: and(
          eq(postPublications.projectId, owner),
          eq(postPublications.platform, "facebook"),
          eq(postPublications.status, "posted"),
        ),
      });
      const lastSnap = latestSnapshotMap(sqlite, owner);
      for (const pub of pubs) {
        if (!pub.externalId) continue;
        const postedAt = pub.postedAt ?? pub.createdAt ?? now;
        if (!snapshotDue(postedAt, lastSnap.get(`${pub.postId}:facebook`) ?? null, now)) continue;
        try {
          const values = await readFacebookPostMetrics(pub.externalId, channel.accessToken);
          if (writeSnapshot(sqlite, owner, pub.postId, "facebook", now, facebookPostMetrics(values)))
            lastSnap.set(`${pub.postId}:facebook`, now);
        } catch {
          // One post can be missing without inventing a zero.
        }
      }
    }
    return {
      refreshed,
      message: refreshed
        ? `Updated ${refreshed} posts${accounts ? " and account stats" : ""}`
        : accounts
          ? "Account stats updated"
          : message,
    };
  } finally {
    refreshing = false;
  }
}

/**
 * Average watch time for a reel. A separate, read-only insights call (the same one
 * scripts/ig-stats.ts makes), so a refusal here never costs the other numbers.
 */
export async function fetchReelWatchTime(
  accessToken: string,
  mediaId: string,
  request: typeof fetch = fetch,
): Promise<MediaInsights> {
  try {
    const params = new URLSearchParams({
      metric: "ig_reels_avg_watch_time",
      access_token: accessToken,
    });
    const response = await request(
      `https://graph.instagram.com/v19.0/${mediaId}/insights?${params}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (data.error || !response.ok) return {};
    return parseMediaInsights(data);
  } catch {
    return {};
  }
}
