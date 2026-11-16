import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  cleanMetrics,
  compareCount,
  daysFromInsightPoints,
  DAY_MS,
  facebookPostMetrics,
  HOUR_MS,
  onlineFollowersFrom,
  optionalMetricNames,
  perHundredLabel,
  perReach,
  snapshotCadenceMs,
  snapshotDue,
  snapshotsToWrite,
} from "@/lib/results";
import {
  CHANNEL_STATE_SQL,
  loadResultSources,
  recordStoredSnapshots,
  syncAgedHub,
} from "@/lib/results-store";
import {
  buildTakeaways,
  postsBeatingMedian,
  weeklyReportMarkdown,
  workTables,
  type ResultPost,
} from "@/lib/results-screen";

const NOW = Date.parse("2026-11-13T12:00:00Z");

function post(partial: Partial<ResultPost> & Pick<ResultPost, "id">): ResultPost {
  return {
    projectId: "p",
    postedAt: Date.parse("2026-11-10T12:00:00Z"),
    day: "2026-11-10",
    hour: 12,
    weekday: 2,
    label: partial.id,
    caption: "A calm caption.",
    imagePath: null,
    formatKey: "carousel",
    formatLabel: "Carousel",
    pillar: "Tips",
    hook: "No hook",
    channels: ["instagram"],
    reach: null,
    views: null,
    likes: null,
    saves: null,
    sends: null,
    follows: null,
    profileVisits: null,
    watchMs: null,
    watchTotalMs: null,
    skipRate: null,
    sendsPerReach: null,
    savesPerReach: null,
    facebookReach: null,
    ...partial,
  };
}

describe("snapshot scheduling", () => {
  it("asks for hourly, then daily, then weekly, then stop", () => {
    expect(snapshotCadenceMs(HOUR_MS)).toBe(HOUR_MS);
    expect(snapshotCadenceMs(3 * DAY_MS)).toBe(DAY_MS);
    expect(snapshotCadenceMs(10 * DAY_MS)).toBe(7 * DAY_MS);
    expect(snapshotCadenceMs(90 * DAY_MS)).toBe(7 * DAY_MS);
    expect(snapshotCadenceMs(90 * DAY_MS + 1)).toBeNull();
  });

  it("stores on the cadence and never sooner than 6 hours", () => {
    const posted = NOW - 10 * HOUR_MS;
    expect(snapshotDue(posted, null, NOW)).toBe(true);
    expect(snapshotDue(posted, NOW - 5 * HOUR_MS, NOW)).toBe(false);
    expect(snapshotDue(posted, NOW - 6 * HOUR_MS, NOW)).toBe(true);
    const day3 = NOW - 3 * DAY_MS;
    expect(snapshotDue(day3, NOW - 23 * HOUR_MS, NOW)).toBe(false);
    expect(snapshotDue(day3, NOW - 24 * HOUR_MS, NOW)).toBe(true);
    const day10 = NOW - 10 * DAY_MS;
    expect(snapshotDue(day10, NOW - 6 * DAY_MS, NOW)).toBe(false);
    expect(snapshotDue(day10, NOW - 7 * DAY_MS, NOW)).toBe(true);
    expect(snapshotDue(NOW - 91 * DAY_MS, null, NOW)).toBe(false);
    expect(snapshotDue(NOW + HOUR_MS, null, NOW)).toBe(false);
  });

  it("stores a reading only when one is due and the metrics exist", () => {
    const row = {
      id: "a",
      postedAt: NOW - 2 * DAY_MS,
      channel: "instagram",
      metrics: cleanMetrics({ reach: 5, bogus: 3, likes: -1 }),
    };
    expect(row.metrics).toEqual({ reach: 5 });
    expect(snapshotsToWrite([row], new Map(), NOW)).toHaveLength(1);
    expect(snapshotsToWrite([row], new Map([["a:instagram", NOW - HOUR_MS]]), NOW)).toHaveLength(0);
    expect(snapshotsToWrite([{ ...row, metrics: {} }], new Map(), NOW)).toHaveLength(0);
  });
});

describe("ratios", () => {
  it("keeps a real zero and leaves an unknown metric missing", () => {
    expect(cleanMetrics({ saved: 0, reach: 8 })).toEqual({ saved: 0, reach: 8 });
    const cleaned = cleanMetrics({ reach: 8 });
    expect(cleaned.follows).toBeUndefined();
    expect(perReach(undefined, 8)).toBeNull();
    expect(perReach(0, 8)).toBe(0);
    expect(perReach(2, 0)).toBeNull();
    expect(perHundredLabel(0.12, 40)).toBe("too few");
    expect(perHundredLabel(0.12, 200)).toBe("12 per 100");
    expect(perHundredLabel(null, null)).toBe("n/a");
  });

  it("refuses a percentage when either side is under 100", () => {
    const small = compareCount("Reach", { current: 312, previous: 41 });
    expect(small.tooFew).toBe(true);
    expect(small.text).toContain("up from");
    expect(small.text).not.toContain("percent");
    const large = compareCount("Reach", { current: 200, previous: 100 });
    expect(large.tooFew).toBe(false);
    expect(large.text).toContain("percent");
  });

  it("asks reels for skip rate and total watch time, and does not invent Facebook views", () => {
    expect(optionalMetricNames("reel")).toContain("reels_skip_rate");
    expect(optionalMetricNames("reel")).toContain("ig_reels_video_view_total_time");
    expect(optionalMetricNames("carousel")).not.toContain("reels_skip_rate");
    expect(facebookPostMetrics({ post_impressions_unique: 4 })).toEqual({ reach: 4 });
    expect(facebookPostMetrics({ post_impressions_unique: 4 }).views).toBeUndefined();
    expect(onlineFollowersFrom({ "0": 2 })).toEqual({ "0": 2 });
    const days = daysFromInsightPoints(
      [{ name: "reach", at: "2026-11-13T08:00:00+0000", value: 12 }],
      "2026-11-13",
    );
    expect(days[0]?.reach).toBe(12);
    expect(days[0]?.views).toBeNull();
  });
});

describe("takeaways and what works", () => {
  it("shows the numbers, greys a cell under 3 posts, and links to Plan or the post", () => {
    const posts = [
      post({ id: "c1", reach: 5, views: 12, sends: 0, saves: 0 }),
      post({ id: "c2", reach: 2, views: 3, sends: 0, saves: 1 }),
      post({ id: "c3", reach: 5, views: 9, sends: 0, saves: 0 }),
      post({ id: "c4", reach: 3, views: 6, sends: 0, saves: 0 }),
      post({
        id: "reel",
        label: "The chart went black",
        formatKey: "reel",
        formatLabel: "Reel",
        reach: 217,
        views: 249,
        sends: 0,
        saves: 0,
      }),
    ];
    const findings = buildTakeaways({
      posts,
      now: NOW,
      planHref: "/projects/p/plan",
      postHref: (id) => `/projects/p/queue?post=${id}`,
    });
    expect(findings.length).toBeGreaterThanOrEqual(3);
    expect(findings.length).toBeLessThanOrEqual(5);
    const best = findings.find((item) => item.id === "best");
    expect(best?.numbers).toContain("217");
    expect(best?.action.href).toBe("/projects/p/queue?post=reel");
    expect(best?.idea).toEqual({
      label: "Plan another like this",
      postId: "reel",
      mode: "again",
    });
    expect(findings.some((item) => item.action.href === "/projects/p/plan")).toBe(true);
    const joined = findings.map((item) => `${item.text} ${item.numbers} ${item.action.label}`).join("\n");
    expect(joined).not.toMatch(/\u2013|\u2014/);
    expect(joined.toLowerCase()).toContain("under 100");
    const tables = workTables(posts);
    const format = tables.find((table) => table.title === "Format");
    expect(format?.cells.find((cell) => cell.label === "Carousel")?.grey).toBe(false);
    expect(format?.cells.find((cell) => cell.label === "Reel")?.grey).toBe(true);
    expect(format?.cells.find((cell) => cell.label === "Reel")?.sample).toBe(1);
  });

  it("offers a reel idea when the best post is not a reel", () => {
    const findings = buildTakeaways({
      posts: [post({ id: "photo", label: "Quiet hour", formatKey: "photo", reach: 40, views: 10 })],
      now: NOW,
      planHref: "/projects/p/plan",
      postHref: (id) => `/projects/p/queue?post=${id}`,
    });
    expect(findings.find((item) => item.id === "best")?.idea).toEqual({
      label: "Turn it into a reel",
      postId: "photo",
      mode: "reel",
    });
  });
});

describe("weekly report", () => {
  it("keeps the baseline headings and table", () => {
    const markdown = weeklyReportMarkdown({
      weekStart: "2026-11-09",
      weekEnd: "2026-11-15",
      followers: 7,
      followsGained: null,
      reach: 12,
      views: 20,
      profileViews: null,
      linkTaps: null,
      posts: [post({ id: "c1", day: "2026-11-10", reach: 5, views: 12, likes: 3, saves: 0, sends: 0 })],
      whatChanged: "Reach 12. No earlier week to compare.",
      reading: "Reach is under 100.",
      nextSentence: "",
    });
    const account = markdown.indexOf("## Account");
    const live = markdown.indexOf("## Live posts");
    const reading = markdown.indexOf("## Reading");
    expect(account).toBeGreaterThan(0);
    expect(live).toBeGreaterThan(account);
    expect(reading).toBeGreaterThan(live);
    expect(markdown).toContain("| Date | Type | Reach | Views | Likes | Saves | Shares |");
    expect(markdown).toContain("| Followers | 7 |");
    expect(markdown).toContain("| 2026-11-10 | Carousel | 5 | 12 | 3 | 0 | 0 |");
    expect(markdown).toContain("(empty)");
    expect(markdown).not.toMatch(/\u2013|\u2014/);
  });
});

function memory() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE projects (id text primary key, name text, brand_color text);
    CREATE TABLE social_channels (
      id text, project_id text, platform text, access_token text, ig_user_id text, account_id text
    );
    CREATE TABLE generated_posts (
      id text primary key, project_id text, status text, posted_at integer, template_type text,
      layout_style text, metadata text, headline text, caption text, image_path text,
      carousel_slides text, insights_json text, insights_updated_at integer
    );
    CREATE TABLE post_publications (id text, post_id text, project_id text, platform text, status text);
    CREATE TABLE post_kb_links (id text, post_id text, entry_id text, how text, created_at integer);
    CREATE TABLE kb_entries (
      id text primary key, project_id text, type text, title text, body text, fields text, tags text,
      pillar text, status text, source text, source_ref text, created_at integer, updated_at integer,
      last_used_at integer, use_count integer
    );
    CREATE TABLE post_metric_snapshots (
      id text primary key, project_id text, post_id text, channel text, taken_at integer, metrics text
    );
    CREATE TABLE account_daily (
      id text primary key, project_id text, channel text, day text, followers integer, reach integer,
      views integer, profile_views integer, accounts_engaged integer, website_taps integer,
      online_followers text, demographics text, updated_at integer
    );
    CREATE UNIQUE INDEX account_daily_project_channel_day ON account_daily (project_id, channel, day);
  `);
  return db;
}

describe("stored rows stay inside the project", () => {
  it("does not select a token value", () => {
    expect(CHANNEL_STATE_SQL).toContain("AS has_token");
    expect(CHANNEL_STATE_SQL).not.toContain("access_token,");
    expect(CHANNEL_STATE_SQL).not.toContain("access_token FROM");
  });

  it("copies stored metrics without borrowing another project's numbers", () => {
    const db = memory();
    db.prepare(`INSERT INTO projects (id, name) VALUES ('a', 'One'), ('b', 'Two')`).run();
    const insert = db.prepare(
      `INSERT INTO generated_posts (id, project_id, status, posted_at, template_type, headline, caption, insights_json)
       VALUES (?, ?, 'posted', ?, 'carousel', ?, 'Caption', ?)`,
    );
    insert.run(
      "pa",
      "a",
      NOW - 2 * DAY_MS,
      "Ours",
      JSON.stringify({ metrics: { reach: 5, views: 9 }, account: { followers: 7 }, accountUpdatedAt: NOW - DAY_MS }),
    );
    insert.run("pb", "b", NOW - DAY_MS, "Theirs", JSON.stringify({ metrics: { reach: 999 } }));
    const first = recordStoredSnapshots(db, "a", NOW);
    expect(first.snapshots).toBe(1);
    expect(first.days).toBe(1);
    const again = recordStoredSnapshots(db, "a", NOW + HOUR_MS);
    expect(again.snapshots).toBe(0);
    const ours = loadResultSources(db, "a");
    const theirs = loadResultSources(db, "b");
    expect(ours?.snapshots.map((row) => row.metrics.reach)).toEqual([5]);
    expect(ours?.snapshots[0]?.metrics.follows).toBeUndefined();
    expect(ours?.days[0]?.followers).toBe(7);
    expect(ours?.days[0]?.reach).toBeNull();
    expect(theirs?.snapshots).toEqual([]);
    expect(JSON.stringify(ours)).not.toContain("999");
  });

  it("updates hub use counts for a post that is 7 days old and proposes one draft", () => {
    const db = memory();
    db.prepare(`INSERT INTO projects (id, name) VALUES ('a', 'One')`).run();
    const insert = db.prepare(
      `INSERT INTO generated_posts (id, project_id, status, posted_at, headline, caption, insights_json)
       VALUES (?, 'a', 'posted', ?, ?, 'A calm caption about the chart.', ?)`,
    );
    insert.run("old", NOW - 8 * DAY_MS, "Standout", JSON.stringify({ metrics: { reach: 200 } }));
    insert.run("s1", NOW - 8 * DAY_MS, "Small", JSON.stringify({ metrics: { reach: 10 } }));
    insert.run("s2", NOW - 8 * DAY_MS, "Smaller", JSON.stringify({ metrics: { reach: 10 } }));
    insert.run("s3", NOW - 2 * DAY_MS, "Recent", JSON.stringify({ metrics: { reach: 400 } }));
    db.prepare(`INSERT INTO kb_entries (id, project_id, type, title, source, use_count) VALUES ('e', 'a', 'fact', 'Chart', 'owner', 0)`).run();
    db.prepare(`INSERT INTO post_kb_links (id, post_id, entry_id, how) VALUES ('l', 'old', 'e', 'fact')`).run();
    syncAgedHub(db, "a", NOW);
    syncAgedHub(db, "a", NOW);
    const useCount = db.prepare(`SELECT use_count AS n FROM kb_entries WHERE id = 'e'`).get() as { n: number };
    const drafts = db.prepare(`SELECT source_ref FROM kb_entries WHERE project_id = 'a' AND status = 'draft'`).all() as {
      source_ref: string;
    }[];
    expect(useCount.n).toBe(1);
    expect(drafts.map((row) => row.source_ref).sort()).toEqual(["results:old:example", "results:old:hook"]);
    expect(postsBeatingMedian(
      [
        { id: "old", postedAt: NOW - 8 * DAY_MS, reach: 200, caption: "A calm caption about the chart." },
        { id: "s1", postedAt: NOW - 8 * DAY_MS, reach: 10, caption: "A calm caption about the chart." },
        { id: "s2", postedAt: NOW - 8 * DAY_MS, reach: 10, caption: "A calm caption about the chart." },
        { id: "s3", postedAt: NOW - 2 * DAY_MS, reach: 400, caption: "A calm caption about the chart." },
      ],
      NOW,
    )).toEqual(["old"]);
  });
});
