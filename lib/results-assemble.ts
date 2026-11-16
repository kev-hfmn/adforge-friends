// Turns stored rows into the Results screen. No network.
import { formatWatchTime } from "./queue-insights";
import { formatDayTime } from "./queue-schedule";
import { compareCount, dayKey, mondayOf, perHundredLabel, shiftDay } from "./results";
import {
  accountSpan,
  buildTakeaways,
  pillarFor,
  postSpan,
  toResultPost,
  workTables,
  type ResultPost,
  type Takeaway,
  type WorkCell,
} from "./results-screen";
import type { ResultSources } from "./results-store";

export type ResultsRow = {
  id: string;
  label: string;
  imagePath: string | null;
  postedAt: number;
  dateLabel: string;
  formatKey: string;
  formatLabel: string;
  pillar: string;
  hook: string;
  channels: string[];
  reach: number | null;
  views: number | null;
  sendsPerReach: number | null;
  savesPerReach: number | null;
  sendsLabel: string;
  savesLabel: string;
  watchMs: number | null;
  watchLabel: string | null;
  skipRate: number | null;
  follows: number | null;
  facebookReach: number | null;
};

export type CurvePoint = { takenAt: number; label: string; reach: number | null; views: number | null };

export type ResultsModel = {
  posts: ResultPost[];
  rows: ResultsRow[];
  curves: { id: string; points: CurvePoint[] }[];
  works: { title: string; cells: WorkCell[] }[];
  takeaways: Takeaway[];
  lines: { text: string; tooFew: boolean }[];
  followerDays: { day: string; followers: number | null }[];
  weekStart: string;
  weekEnd: string;
};

export function assembleResults(
  sources: ResultSources,
  pillars: readonly { id: string; label: string }[],
  now: number,
  href: { plan: string; post: (id: string) => string },
): ResultsModel {
  const hookByPost = new Map<string, string>();
  for (const hook of sources.hooks) if (!hookByPost.has(hook.postId)) hookByPost.set(hook.postId, hook.title);
  const facebookReach = new Map<string, number>();
  for (const snap of [...sources.snapshots].reverse()) {
    if (snap.channel !== "facebook" || typeof snap.metrics.reach !== "number") continue;
    if (!facebookReach.has(snap.postId)) facebookReach.set(snap.postId, snap.metrics.reach);
  }
  const posts = sources.posts.flatMap((post) => {
    const row = toResultPost(post, {
      pillar: pillarFor(post, pillars),
      hook: hookByPost.get(post.id) ?? null,
      publications: sources.publications.filter((item) => item.postId === post.id),
      facebookReach: facebookReach.get(post.id) ?? null,
    });
    return row ? [row] : [];
  });
  const measured = posts.filter((post) => post.reach != null || post.views != null);
  const start = mondayOf(dayKey(now));
  const end = shiftDay(start, 6);
  const prevStart = shiftDay(start, -7);
  const prevEnd = shiftDay(start, -1);
  const accountNow = accountSpan(sources.days, "instagram", start, end);
  const accountPrev = accountSpan(sources.days, "instagram", prevStart, prevEnd);
  const postsNow = postSpan(posts, start, end);
  const postsPrev = postSpan(posts, prevStart, prevEnd);
  const lines = [
    compareCount("Followers", { current: accountNow.followers, previous: accountPrev.followers }),
    accountNow.reach != null
      ? compareCount("Reach", { current: accountNow.reach, previous: accountPrev.reach })
      : compareCount("Reach from posts", { current: postsNow.reach, previous: postsPrev.reach }),
    accountNow.views != null
      ? compareCount("Views", { current: accountNow.views, previous: accountPrev.views })
      : compareCount("Views from posts", { current: postsNow.views, previous: postsPrev.views }),
    compareCount("Posts", { current: postsNow.posts, previous: postsPrev.posts }),
  ];
  return {
    posts,
    rows: posts.map((post) => ({
      id: post.id,
      label: post.label,
      imagePath: post.imagePath,
      postedAt: post.postedAt,
      dateLabel: formatDayTime(post.postedAt),
      formatKey: post.formatKey,
      formatLabel: post.formatLabel,
      pillar: post.pillar,
      hook: post.hook,
      channels: post.channels,
      reach: post.reach,
      views: post.views,
      sendsPerReach: post.sendsPerReach,
      savesPerReach: post.savesPerReach,
      sendsLabel: perHundredLabel(post.sendsPerReach, post.reach),
      savesLabel: perHundredLabel(post.savesPerReach, post.reach),
      watchMs: post.watchMs,
      watchLabel: formatWatchTime(post.watchMs ?? undefined),
      skipRate: post.skipRate,
      follows: post.follows,
      facebookReach: post.facebookReach,
    })),
    curves: posts.map((post) => ({
      id: post.id,
      points: sources.snapshots
        .filter((snap) => snap.postId === post.id && snap.channel !== "facebook")
        .map((snap) => ({
          takenAt: snap.takenAt,
          label: formatDayTime(snap.takenAt),
          reach: snap.metrics.reach ?? null,
          views: snap.metrics.views ?? null,
        })),
    })),
    works: workTables(measured),
    takeaways: buildTakeaways({
      posts: measured,
      now,
      planHref: href.plan,
      postHref: href.post,
    }),
    lines,
    followerDays: sources.days
      .filter((day) => day.channel === "instagram")
      .map((day) => ({ day: day.day, followers: day.followers })),
    weekStart: start,
    weekEnd: end,
  };
}
