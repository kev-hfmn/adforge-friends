// Stored Results rows. Callers pass a database. Nothing here calls a network or reads a token value out.
import type Database from "better-sqlite3";
import { storedInsights, type MediaInsights } from "./queue-insights";
import {
  cleanMetrics,
  dayKey,
  INSIGHTS_MIN_GAP_MS,
  snapshotsToWrite,
  type DayDraft,
} from "./results";
import { hookLine, postsBeatingMedian, type AccountDay } from "./results-screen";
import { targetChannel } from "./queue-view";

export const CHANNEL_STATE_SQL = `SELECT platform,
  CASE WHEN access_token IS NOT NULL AND length(access_token) > 0 THEN 1 ELSE 0 END AS has_token,
  CASE WHEN ig_user_id IS NOT NULL AND length(ig_user_id) > 0 THEN 1 ELSE 0 END AS has_ig,
  CASE WHEN account_id IS NOT NULL AND length(account_id) > 0 THEN 1 ELSE 0 END AS has_account
FROM social_channels WHERE project_id = ?`;

export type StoredPost = {
  id: string;
  projectId: string;
  postedAt: number | null;
  templateType: string | null;
  layoutStyle: string | null;
  metadata: string | null;
  headline: string | null;
  caption: string | null;
  imagePath: string | null;
  carouselSlides: string | null;
  insightsJson: string | null;
};

export type ResultSources = {
  project: { id: string; name: string; brandColor: string };
  instagramConnected: boolean;
  facebookConnected: boolean;
  posts: StoredPost[];
  publications: { postId: string; platform: string; status: string | null }[];
  hooks: { postId: string; title: string }[];
  snapshots: { postId: string; channel: string; takenAt: number; metrics: MediaInsights }[];
  days: AccountDay[];
};

type ChannelState = { platform: string | null; has_token: number; has_ig: number; has_account: number };

export function loadResultSources(db: Database.Database, projectId: string): ResultSources | null {
  const project = db
    .prepare(`SELECT id, name, brand_color AS brandColor FROM projects WHERE id = ?`)
    .get(projectId) as { id: string; name: string; brandColor: string | null } | undefined;
  if (!project) return null;
  const channels = db.prepare(CHANNEL_STATE_SQL).all(projectId) as ChannelState[];
  const posts = db
    .prepare(
      `SELECT id, project_id AS projectId, posted_at AS postedAt, template_type AS templateType,
              layout_style AS layoutStyle, metadata, headline, caption, image_path AS imagePath,
              carousel_slides AS carouselSlides, insights_json AS insightsJson
       FROM generated_posts
       WHERE project_id = ? AND status = 'posted' AND posted_at IS NOT NULL
       ORDER BY posted_at DESC`,
    )
    .all(projectId) as StoredPost[];
  const publications = db
    .prepare(
      `SELECT post_id AS postId, platform, status FROM post_publications WHERE project_id = ?`,
    )
    .all(projectId) as ResultSources["publications"];
  const hooks = db
    .prepare(
      `SELECT l.post_id AS postId, e.title
       FROM post_kb_links l
       JOIN kb_entries e ON e.id = l.entry_id
       JOIN generated_posts p ON p.id = l.post_id
       WHERE p.project_id = ? AND e.project_id = ? AND e.type = 'hook'
       ORDER BY e.title COLLATE NOCASE`,
    )
    .all(projectId, projectId) as ResultSources["hooks"];
  const snapshots = (
    db
      .prepare(
        `SELECT post_id AS postId, channel, taken_at AS takenAt, metrics
         FROM post_metric_snapshots
         WHERE project_id = ?
         ORDER BY taken_at ASC`,
      )
      .all(projectId) as { postId: string; channel: string; takenAt: number; metrics: string }[]
  ).map((row) => ({
    postId: row.postId,
    channel: row.channel,
    takenAt: row.takenAt,
    metrics: cleanMetrics(JSON.parse(row.metrics || "{}")),
  }));
  const days = (
    db
      .prepare(
        `SELECT channel, day, followers, reach, views, profile_views AS profileViews,
                accounts_engaged AS accountsEngaged, website_taps AS websiteTaps,
                online_followers AS onlineFollowers, demographics
         FROM account_daily
         WHERE project_id = ?
         ORDER BY day ASC`,
      )
      .all(projectId) as {
      channel: string;
      day: string;
      followers: number | null;
      reach: number | null;
      views: number | null;
      profileViews: number | null;
      accountsEngaged: number | null;
      websiteTaps: number | null;
      onlineFollowers: string | null;
      demographics: string | null;
    }[]
  ).map((row) => ({
    channel: row.channel,
    day: row.day,
    followers: row.followers,
    reach: row.reach,
    views: row.views,
    profileViews: row.profileViews,
    accountsEngaged: row.accountsEngaged,
    websiteTaps: row.websiteTaps,
    onlineFollowers: parseJson(row.onlineFollowers),
    demographics: row.demographics ? parseJson(row.demographics) : null,
  }));
  return {
    project: { id: project.id, name: project.name, brandColor: project.brandColor || "#40b0c8" },
    instagramConnected: channels.some((row) => row.platform === "instagram" && row.has_token === 1 && row.has_ig === 1),
    facebookConnected: channels.some((row) => row.platform === "facebook" && row.has_token === 1 && row.has_account === 1),
    posts,
    publications,
    hooks,
    snapshots,
    days,
  };
}

function parseJson(value: string | null): Record<string, number> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : null;
  } catch {
    return null;
  }
}

export function latestSnapshotMap(db: Database.Database, projectId: string): Map<string, number | null> {
  const rows = db
    .prepare(
      `SELECT post_id, channel, max(taken_at) AS taken_at
       FROM post_metric_snapshots WHERE project_id = ? GROUP BY post_id, channel`,
    )
    .all(projectId) as { post_id: string; channel: string; taken_at: number }[];
  const map = new Map<string, number | null>();
  for (const row of rows) map.set(`${row.post_id}:${row.channel}`, row.taken_at);
  return map;
}

export function writeSnapshot(
  db: Database.Database,
  projectId: string,
  postId: string,
  channel: string,
  takenAt: number,
  metrics: object,
): boolean {
  const owns = db.prepare(`SELECT 1 AS ok FROM generated_posts WHERE id = ? AND project_id = ?`).get(postId, projectId);
  const clean = cleanMetrics(metrics);
  if (!owns || !Object.keys(clean).length) return false;
  db.prepare(
    `INSERT INTO post_metric_snapshots (id, project_id, post_id, channel, taken_at, metrics) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), projectId, postId, channel, takenAt, JSON.stringify(clean));
  return true;
}

export function accountDayFresh(db: Database.Database, projectId: string, channel: string, now: number): boolean {
  const row = db
    .prepare(`SELECT max(updated_at) AS updatedAt FROM account_daily WHERE project_id = ? AND channel = ?`)
    .get(projectId, channel) as { updatedAt: number | null } | undefined;
  return row?.updatedAt != null && now - row.updatedAt < INSIGHTS_MIN_GAP_MS;
}

export function writeAccountDays(
  db: Database.Database,
  projectId: string,
  channel: string,
  days: readonly DayDraft[],
  now: number,
  force = false,
): number {
  const insert = db.prepare(
    `INSERT INTO account_daily
      (id, project_id, channel, day, followers, reach, views, profile_views, accounts_engaged, website_taps, online_followers, demographics, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, channel, day) DO UPDATE SET
       followers = COALESCE(excluded.followers, account_daily.followers),
       reach = COALESCE(excluded.reach, account_daily.reach),
       views = COALESCE(excluded.views, account_daily.views),
       profile_views = COALESCE(excluded.profile_views, account_daily.profile_views),
       accounts_engaged = COALESCE(excluded.accounts_engaged, account_daily.accounts_engaged),
       website_taps = COALESCE(excluded.website_taps, account_daily.website_taps),
       online_followers = COALESCE(excluded.online_followers, account_daily.online_followers),
       demographics = COALESCE(excluded.demographics, account_daily.demographics),
       updated_at = excluded.updated_at
     WHERE ? = 1 OR account_daily.updated_at IS NULL OR excluded.updated_at - account_daily.updated_at >= ?`,
  );
  let written = 0;
  for (const day of days) {
    const info = insert.run(
      crypto.randomUUID(),
      projectId,
      channel,
      day.day,
      day.followers,
      day.reach,
      day.views,
      day.profileViews,
      day.accountsEngaged,
      day.websiteTaps,
      day.onlineFollowers ? JSON.stringify(day.onlineFollowers) : null,
      day.demographics != null ? JSON.stringify(day.demographics) : null,
      now,
      force ? 1 : 0,
      INSIGHTS_MIN_GAP_MS,
    );
    written += info.changes;
  }
  return written;
}

/** Copy numbers already stored on posts. No network, and no invented zeros. */
export function recordStoredSnapshots(
  db: Database.Database,
  projectId: string,
  now: number,
): { snapshots: number; days: number } {
  const posts = db
    .prepare(
      `SELECT id, posted_at AS postedAt, insights_json AS insightsJson, metadata
       FROM generated_posts
       WHERE project_id = ? AND status = 'posted' AND posted_at IS NOT NULL`,
    )
    .all(projectId) as {
    id: string;
    postedAt: number;
    insightsJson: string | null;
    metadata: string | null;
  }[];
  const pending = snapshotsToWrite(
    posts.map((post) => ({
      id: post.id,
      postedAt: post.postedAt,
      channel: targetChannel({ metadata: post.metadata }),
      metrics: cleanMetrics(storedInsights(post.insightsJson).metrics),
    })),
    latestSnapshotMap(db, projectId),
    now,
  );
  let snapshots = 0;
  for (const row of pending) {
    if (writeSnapshot(db, projectId, row.id, row.channel, now, row.metrics)) snapshots += 1;
  }
  const byDay = new Map<string, { followers: number; at: number }>();
  for (const post of posts) {
    const stored = storedInsights(post.insightsJson);
    const followers = stored.account?.followers;
    const at = stored.accountUpdatedAt;
    if (typeof followers !== "number" || at == null) continue;
    const day = dayKey(at);
    const prev = byDay.get(day);
    if (!prev || at > prev.at) byDay.set(day, { followers, at });
  }
  const ignore = db.prepare(
    `INSERT OR IGNORE INTO account_daily
      (id, project_id, channel, day, followers, reach, views, profile_views, accounts_engaged, website_taps, online_followers, demographics, updated_at)
     VALUES (?, ?, 'instagram', ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`,
  );
  let days = 0;
  for (const [day, row] of byDay) {
    days += ignore.run(crypto.randomUUID(), projectId, day, row.followers, row.at).changes;
  }
  return { snapshots, days };
}

export function syncAgedHub(db: Database.Database, projectId: string, now: number): void {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  db.prepare(
    `UPDATE kb_entries
     SET use_count = (
       SELECT count(DISTINCT l.post_id)
       FROM post_kb_links l
       JOIN generated_posts p ON p.id = l.post_id
       WHERE l.entry_id = kb_entries.id
         AND p.project_id = ?
         AND p.status = 'posted'
         AND p.posted_at IS NOT NULL
         AND p.posted_at <= ?
     )
     WHERE project_id = ?`,
  ).run(projectId, cutoff, projectId);
  const posts = db
    .prepare(
      `SELECT id, posted_at AS postedAt, insights_json AS insightsJson, caption, headline
       FROM generated_posts
       WHERE project_id = ? AND status = 'posted' AND posted_at IS NOT NULL`,
    )
    .all(projectId) as {
    id: string;
    postedAt: number;
    insightsJson: string | null;
    caption: string | null;
    headline: string | null;
  }[];
  const winners = new Set(
    postsBeatingMedian(
      posts.map((post) => ({
        id: post.id,
        postedAt: post.postedAt,
        reach: cleanMetrics(storedInsights(post.insightsJson).metrics).reach ?? null,
        caption: post.caption ?? "",
      })),
      now,
    ),
  );
  const exists = db.prepare(`SELECT 1 AS ok FROM kb_entries WHERE project_id = ? AND source_ref = ?`);
  const insert = db.prepare(
    `INSERT INTO kb_entries
      (id, project_id, type, title, body, fields, tags, pillar, status, source, source_ref, created_at, updated_at, use_count)
     VALUES (?, ?, ?, ?, ?, ?, '[]', NULL, 'draft', 'results', ?, ?, ?, 0)`,
  );
  for (const post of posts) {
    if (!winners.has(post.id)) continue;
    const caption = (post.caption ?? "").trim();
    if (!caption) continue;
    const exampleRef = `results:${post.id}:example`;
    if (!exists.get(projectId, exampleRef)) {
      insert.run(
        crypto.randomUUID(),
        projectId,
        "example",
        (post.headline || "Post").slice(0, 120),
        caption,
        JSON.stringify({ fromPost: post.id }),
        exampleRef,
        now,
        now,
      );
    }
    const line = hookLine(caption);
    const hookRef = `results:${post.id}:hook`;
    if (line && !exists.get(projectId, hookRef)) {
      insert.run(
        crypto.randomUUID(),
        projectId,
        "hook",
        line.slice(0, 120),
        line,
        JSON.stringify({ fromPost: post.id }),
        hookRef,
        now,
        now,
      );
    }
  }
}
