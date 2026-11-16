// Post rows, what-works tables, takeaways and the weekly report. No network.
import { formatLabel, pillarLabel, planFormat } from "./plan";
import { formatWatchTime, storedInsights } from "./queue-insights";
import { postLabel, queueKind, targetChannel, type QueuePost } from "./queue-view";
import {
  cleanMetrics,
  COMPARE_REACH,
  DAY_MS,
  zoneParts,
  median,
  MIN_SAMPLE,
  perHundredLabel,
  perReach,
  RESULT_WINDOW_DAYS,
  sumDefined,
} from "./results";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ResultPost = {
  id: string;
  projectId: string;
  postedAt: number;
  day: string;
  hour: number;
  weekday: number;
  label: string;
  caption: string;
  imagePath: string | null;
  formatKey: string;
  formatLabel: string;
  pillar: string;
  hook: string;
  channels: string[];
  reach: number | null;
  views: number | null;
  likes: number | null;
  saves: number | null;
  sends: number | null;
  follows: number | null;
  profileVisits: number | null;
  watchMs: number | null;
  watchTotalMs: number | null;
  skipRate: number | null;
  sendsPerReach: number | null;
  savesPerReach: number | null;
  facebookReach: number | null;
};

export function resultChannels(
  facebookOnly: boolean,
  publications: readonly { platform: string; status: string | null }[],
): string[] {
  const channels: string[] = [];
  if (!facebookOnly) channels.push("instagram");
  if (facebookOnly || publications.some((row) => row.platform === "facebook" && row.status === "posted"))
    channels.push("facebook");
  if (publications.some((row) => row.platform === "tiktok" && row.status === "posted")) channels.push("tiktok");
  return channels;
}

export function toResultPost(
  post: Pick<
    QueuePost,
    | "id"
    | "projectId"
    | "postedAt"
    | "templateType"
    | "layoutStyle"
    | "metadata"
    | "headline"
    | "caption"
    | "imagePath"
    | "carouselSlides"
    | "insightsJson"
  >,
  extras: {
    pillar: string | null;
    hook: string | null;
    publications: readonly { platform: string; status: string | null }[];
    facebookReach: number | null;
  },
): ResultPost | null {
  if (post.postedAt == null || post.projectId == null) return null;
  const metrics = cleanMetrics(storedInsights(post.insightsJson).metrics);
  const parts = zoneParts(post.postedAt);
  const shaped = planFormat(post);
  const reach = metrics.reach ?? null;
  const sends = metrics.shares ?? null;
  const saves = metrics.saved ?? null;
  return {
    id: post.id,
    projectId: post.projectId,
    postedAt: post.postedAt,
    day: parts.day,
    hour: parts.hour,
    weekday: parts.weekday,
    label: postLabel(post as QueuePost),
    caption: post.caption ?? "",
    imagePath: post.imagePath,
    formatKey: shaped.format,
    formatLabel: formatLabel(shaped.format, shaped.slides),
    pillar: extras.pillar ?? "No pillar",
    hook: extras.hook ?? "No hook",
    channels: resultChannels(targetChannel(post) === "facebook", extras.publications),
    reach,
    views: metrics.views ?? null,
    likes: metrics.likes ?? null,
    saves,
    sends,
    follows: metrics.follows ?? null,
    profileVisits: metrics.profile_visits ?? null,
    watchMs: metrics.ig_reels_avg_watch_time ?? null,
    watchTotalMs: metrics.ig_reels_video_view_total_time ?? null,
    skipRate: metrics.reels_skip_rate ?? null,
    sendsPerReach: perReach(sends ?? undefined, reach ?? undefined),
    savesPerReach: perReach(saves ?? undefined, reach ?? undefined),
    facebookReach: extras.facebookReach,
  };
}

export function pillarFor(
  post: Pick<QueuePost, "templateType" | "layoutStyle" | "metadata">,
  pillars: readonly { id: string; label: string }[],
): string | null {
  return pillarLabel(queueKind(post), pillars);
}

export type WorkCell = {
  label: string;
  sample: number;
  medianReach: number | null;
  medianSendsPerReach: number | null;
  medianSavesPerReach: number | null;
  medianWatchMs: number | null;
  grey: boolean;
};

function cellsBy(posts: readonly ResultPost[], keyOf: (post: ResultPost) => string): WorkCell[] {
  const groups = new Map<string, ResultPost[]>();
  for (const post of posts) {
    const key = keyOf(post);
    const list = groups.get(key);
    if (list) list.push(post);
    else groups.set(key, [post]);
  }
  return [...groups.entries()]
    .map(([label, rows]) => ({
      label,
      sample: rows.length,
      medianReach: median(rows.flatMap((row) => (row.reach == null ? [] : [row.reach]))),
      medianSendsPerReach: median(rows.flatMap((row) => (row.sendsPerReach == null ? [] : [row.sendsPerReach]))),
      medianSavesPerReach: median(rows.flatMap((row) => (row.savesPerReach == null ? [] : [row.savesPerReach]))),
      medianWatchMs: median(rows.flatMap((row) => (row.watchMs == null ? [] : [row.watchMs]))),
      grey: rows.length < MIN_SAMPLE,
    }))
    .sort((a, b) => b.sample - a.sample || a.label.localeCompare(b.label));
}

function formatGroup(post: ResultPost): string {
  if (post.formatKey === "carousel") return "Carousel";
  if (post.formatKey === "reel") return "Reel";
  return "Photo";
}

export function workTables(posts: readonly ResultPost[]): { title: string; cells: WorkCell[] }[] {
  return [
    { title: "Format", cells: cellsBy(posts, formatGroup) },
    { title: "Pillar", cells: cellsBy(posts, (post) => post.pillar) },
    { title: "Hour", cells: cellsBy(posts, (post) => `${String(post.hour).padStart(2, "0")}:00`) },
    { title: "Weekday", cells: cellsBy(posts, (post) => WEEKDAY[post.weekday] ?? "Day") },
    { title: "Hook", cells: cellsBy(posts, (post) => post.hook) },
  ];
}

export type Takeaway = {
  id: string;
  text: string;
  numbers: string;
  action: { label: string; href: string };
  /** A rule, not a model. The button creates an idea linked to the post. */
  idea?: { label: string; postId: string; mode: "reel" | "again" };
};

export function buildTakeaways(input: {
  posts: readonly ResultPost[];
  now: number;
  planHref: string;
  postHref: (id: string) => string;
  windowDays?: number;
}): Takeaway[] {
  const start = input.now - (input.windowDays ?? RESULT_WINDOW_DAYS) * DAY_MS;
  const posts = input.posts.filter((post) => post.postedAt >= start);
  const plan = { label: "Open Plan", href: input.planHref };
  const findings: Takeaway[] = [];
  const push = (
    id: string,
    text: string,
    numbers: string,
    action: Takeaway["action"],
    idea?: Takeaway["idea"],
  ) => {
    if (findings.length >= 5) return;
    findings.push(idea ? { id, text, numbers, action, idea } : { id, text, numbers, action });
  };
  if (!posts.length) {
    push("empty", "No posted numbers in the last 4 weeks.", "0 posts.", plan);
    return findings;
  }
  const withReach = posts.filter((post) => post.reach != null);
  if (withReach.length < MIN_SAMPLE) {
    push(
      "sample",
      "Fewer than 3 posts with numbers. A pattern needs at least 3.",
      `${withReach.length} posts with a reach number.`,
      plan,
    );
  }
  if (withReach.length && withReach.every((post) => (post.reach ?? 0) < COMPARE_REACH)) {
    const highest = Math.max(...withReach.map((post) => post.reach ?? 0));
    push(
      "small",
      "Reach is under 100, so this screen shows counts only.",
      `Highest reach ${highest.toLocaleString("en-GB")}. Posts with a reach number: ${withReach.length}.`,
      plan,
    );
  }
  const best = [...withReach].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];
  if (best?.reach != null) {
    const reel = best.formatKey === "reel";
    push(
      "best",
      `Best reach in the last 4 weeks: ${best.label.replace(/\.$/, "")}.`,
      `Reach ${best.reach.toLocaleString("en-GB")}. Views ${best.views == null ? "n/a" : best.views.toLocaleString("en-GB")}.`,
      { label: "Open the post", href: input.postHref(best.id) },
      {
        label: reel ? "Plan another like this" : "Turn it into a reel",
        postId: best.id,
        mode: reel ? "again" : "reel",
      },
    );
  }
  const formats = cellsBy(posts, formatGroup).filter((cell) => !cell.grey);
  if (formats.length === 1) {
    const small = (formats[0].medianReach ?? 0) < COMPARE_REACH;
    push(
      "format-one",
      small
        ? `${formats[0].label} is the only format with at least 3 posts. Reach is under 100, so this is a count.`
        : `${formats[0].label} is the only format with at least 3 posts.`,
      `${formats[0].sample} posts. Median reach ${formats[0].medianReach ?? "n/a"}.`,
      plan,
    );
  } else if (formats.length >= 2) {
    const [a, b] = formats;
    const comparable =
      (a.medianReach ?? 0) >= COMPARE_REACH &&
      (b.medianReach ?? 0) >= COMPARE_REACH &&
      a.medianSendsPerReach != null &&
      b.medianSendsPerReach != null;
    if (!comparable) {
      push(
        "format",
        `${a.label} and ${b.label} both have at least 3 posts. Reach is too small to compare as a rate.`,
        `${a.label}: ${a.sample} posts, median reach ${a.medianReach ?? "n/a"}. ${b.label}: ${b.sample} posts, median reach ${b.medianReach ?? "n/a"}.`,
        plan,
      );
    } else {
      const left = a.medianSendsPerReach ?? 0;
      const right = b.medianSendsPerReach ?? 0;
      const winner = left >= right ? a : b;
      const loser = left >= right ? b : a;
      push(
        "format",
        `${winner.label} was forwarded more often than ${loser.label} over 4 weeks.`,
        `${winner.label}: ${winner.sample} posts, ${perHundredLabel(winner.medianSendsPerReach, winner.medianReach)}. ${loser.label}: ${loser.sample} posts, ${perHundredLabel(loser.medianSendsPerReach, loser.medianReach)}.`,
        plan,
      );
    }
  }
  const withSends = posts.filter((post) => post.sends != null);
  if (withSends.length >= MIN_SAMPLE && withSends.every((post) => post.sends === 0)) {
    push(
      "sends",
      "No post in this window was forwarded.",
      `${withSends.length} posts with a sends number, all 0.`,
      plan,
    );
  }
  const reels = posts.filter((post) => post.formatKey === "reel" && post.watchMs != null);
  if (reels.length >= MIN_SAMPLE) {
    const watch = median(reels.map((post) => post.watchMs ?? 0));
    push(
      "watch",
      "Reels with a watch time.",
      `${reels.length} reels. Median average watch ${formatWatchTime(watch ?? undefined) ?? "n/a"}.`,
      plan,
    );
  }
  return findings;
}

export type AccountDay = {
  channel: string;
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

export function inSpan(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export function accountSpan(rows: readonly AccountDay[], channel: string, start: string, end: string) {
  const slice = rows.filter((row) => row.channel === channel && inSpan(row.day, start, end));
  const lastFollowers = [...slice].reverse().find((row) => row.followers != null)?.followers ?? null;
  return {
    followers: lastFollowers,
    reach: sumDefined(slice.map((row) => row.reach)),
    views: sumDefined(slice.map((row) => row.views)),
    profileViews: sumDefined(slice.map((row) => row.profileViews)),
    accountsEngaged: sumDefined(slice.map((row) => row.accountsEngaged)),
    websiteTaps: sumDefined(slice.map((row) => row.websiteTaps)),
    days: slice.length,
  };
}

export function postSpan(posts: readonly ResultPost[], start: string, end: string) {
  const slice = posts.filter((post) => inSpan(post.day, start, end));
  return {
    posts: slice.length,
    reach: sumDefined(slice.map((post) => post.reach)),
    views: sumDefined(slice.map((post) => post.views)),
    follows: sumDefined(slice.map((post) => post.follows)),
    profileViews: sumDefined(slice.map((post) => post.profileVisits)),
    rows: slice,
  };
}

function num(value: number | null): string {
  return value == null ? "n/a" : value.toLocaleString("en-GB");
}

export function weeklyReportMarkdown(input: {
  weekStart: string;
  weekEnd: string;
  followers: number | null;
  followsGained: number | null;
  reach: number | null;
  views: number | null;
  profileViews: number | null;
  linkTaps: number | null;
  posts: readonly ResultPost[];
  whatChanged: string;
  reading: string;
  nextSentence: string;
}): string {
  const header = "| Date | Type | Reach | Views | Likes | Saves | Shares |";
  const lines = input.posts.map((post) => {
    return `| ${post.day} | ${post.formatLabel} | ${num(post.reach)} | ${num(post.views)} | ${num(post.likes)} | ${num(post.saves)} | ${num(post.sends)} |`;
  });
  const bySends = [...input.posts].sort((a, b) => (b.sends ?? -1) - (a.sends ?? -1)).slice(0, 3);
  const bySaves = [...input.posts].sort((a, b) => (b.saves ?? -1) - (a.saves ?? -1)).slice(0, 3);
  const list = (rows: ResultPost[], field: "sends" | "saves") =>
    rows.length
      ? rows
          .map((post) => {
            const count = field === "sends" ? post.sends : post.saves;
            const rate = field === "sends" ? post.sendsPerReach : post.savesPerReach;
            const rateText = perHundredLabel(rate, post.reach);
            return `- ${post.label} (${post.day}): ${count == null ? "n/a" : count} ${field}, reach ${num(post.reach)}, ${rateText}.`;
          })
          .join("\n")
      : "- None.";
  const sentence = input.nextSentence.trim() || "(empty)";
  return `# Week of ${input.weekStart}

Posts from ${input.weekStart} to ${input.weekEnd}. Every number is taken from stored rows.

## Account

| | |
|---|---|
| Followers | ${num(input.followers)} |
| Follows gained | ${num(input.followsGained)} |
| Reach | ${num(input.reach)} |
| Views | ${num(input.views)} |
| Profile views | ${num(input.profileViews)} |
| Link taps | ${num(input.linkTaps)} |
| Posts out | ${input.posts.length} |
| What changed | ${input.whatChanged} |

## Live posts

${header}
|---|---|---|---|---|---|---|
${lines.length ? lines.join("\n") : "| | | | | | | |"}

## Reading

${input.reading}

Top 3 by sends:

${list(bySends, "sends")}

Top 3 by saves:

${list(bySaves, "saves")}

What changes next:

${sentence}
`;
}

export function postsBeatingMedian(
  posts: readonly Pick<ResultPost, "id" | "postedAt" | "reach" | "caption">[],
  now: number,
): string[] {
  const aged = posts.filter((post) => post.reach != null && now - post.postedAt >= 7 * DAY_MS);
  const sample = posts.filter((post) => post.reach != null);
  if (sample.length < MIN_SAMPLE) return [];
  const mid = median(sample.map((post) => post.reach ?? 0));
  if (mid == null) return [];
  return aged.filter((post) => (post.reach ?? 0) > mid && post.caption.trim()).map((post) => post.id);
}

export function hookLine(caption: string): string | null {
  const line = caption
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length >= 3);
  if (!line) return null;
  return line.length > 140 ? `${line.slice(0, 137).trimEnd()}...` : line;
}

