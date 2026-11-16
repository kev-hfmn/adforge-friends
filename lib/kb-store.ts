import { QUEUE_TIME_ZONE } from "@/lib/queue-schedule";
// SQLite reads and writes for the hub. Callers pass a database so tests
// do not open the app's file. Nothing here publishes.
import type Database from "better-sqlite3";
import { fingerprint, type HubEntryDraft, type HubFields, type HubWarning, type KbType } from "./kb-types";
import { planSync } from "./kb-sync-plan";

export type HubRow = {
  id: string;
  projectId: string;
  type: KbType;
  title: string;
  body: string;
  fields: HubFields;
  tags: string[];
  pillar: string | null;
  status: string;
  source: string;
  sourceRef: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastUsedAt: number | null;
  useCount: number;
};

type Raw = Record<string, unknown>;

const STOP = new Set([
  "that", "this", "with", "from", "have", "your", "about", "there", "their",
  "what", "when", "where", "which", "will", "just", "into", "they", "them",
  "than", "then", "been", "were", "said", "says", "each", "only", "over",
]);

function text(row: Raw, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
function num(row: Raw, key: string): number | null {
  const value = row[key];
  return typeof value === "number" ? value : null;
}
function fieldsOf(value: string): HubFields {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: HubFields = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === "string") out[key] = item;
      else if (Array.isArray(item) && item.every((part) => typeof part === "string")) out[key] = item;
    }
    return out;
  } catch {
    return {};
  }
}
function tagsOf(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function mapRow(row: Raw): HubRow {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    type: text(row, "type") as KbType,
    title: text(row, "title"),
    body: text(row, "body"),
    fields: fieldsOf(text(row, "fields")),
    tags: tagsOf(text(row, "tags")),
    pillar: text(row, "pillar") || null,
    status: text(row, "status") || "active",
    source: text(row, "source"),
    sourceRef: text(row, "source_ref") || null,
    createdAt: num(row, "created_at"),
    updatedAt: num(row, "updated_at"),
    lastUsedAt: num(row, "last_used_at"),
    useCount: num(row, "use_count") ?? 0,
  };
}

export function ftsQuery(raw: string, mode: "and" | "or" = "and"): string {
  const tokens = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}.]+/u)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .slice(0, 12);
  if (!tokens.length) return "";
  const quoted = tokens.map((token) => `"${token.replaceAll('"', "")}"`);
  return quoted.join(mode === "or" ? " OR " : " ");
}

export function applySync(
  sqlite: Database.Database,
  projectId: string,
  incoming: HubEntryDraft[],
  scopePrefixes: string[],
  warnings: HubWarning[],
): { inserted: number; updated: number; retired: number; unchanged: number } {
  const existing = sqlite
    .prepare(
      `SELECT id, source_ref, type, title, body, fields, tags, pillar, status
       FROM kb_entries WHERE project_id = ? AND source_ref IS NOT NULL`,
    )
    .all(projectId) as Raw[];
  const plan = planSync(
    existing.map((row) => ({
      id: text(row, "id"),
      syncKey: text(row, "source_ref"),
      status: text(row, "status"),
      fingerprint: fingerprint({
        syncKey: text(row, "source_ref"),
        type: text(row, "type") as KbType,
        title: text(row, "title"),
        body: text(row, "body"),
        fields: fieldsOf(text(row, "fields")),
        tags: tagsOf(text(row, "tags")),
        pillar: text(row, "pillar") || null,
      }),
    })),
    incoming,
    scopePrefixes,
  );
  const now = Date.now();
  const insert = sqlite.prepare(
    `INSERT INTO kb_entries
      (id, project_id, type, title, body, fields, tags, pillar, status, source, source_ref, created_at, updated_at, use_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0)`,
  );
  const version = sqlite.prepare(
    `INSERT INTO kb_versions (id, entry_id, title, body, fields, editor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = sqlite.prepare(
    `UPDATE kb_entries
     SET type=?, title=?, body=?, fields=?, tags=?, pillar=?, status='active', source=?, updated_at=?
     WHERE id=?`,
  );
  const retire = sqlite.prepare(
    `UPDATE kb_entries SET status='retired', updated_at=? WHERE project_id=? AND source_ref=? AND status!='retired'`,
  );
  const stats = { inserted: 0, updated: 0, retired: 0, unchanged: incoming.length - plan.insert.length - plan.update.length };
  const write = sqlite.transaction(() => {
    for (const entry of plan.insert) {
      insert.run(
        crypto.randomUUID(),
        projectId,
        entry.type,
        entry.title,
        entry.body,
        JSON.stringify(entry.fields),
        JSON.stringify([...entry.tags].sort()),
        entry.pillar,
        sourceOf(entry.syncKey),
        entry.syncKey,
        now,
        now,
      );
      stats.inserted += 1;
    }
    for (const change of plan.update) {
      const prev = existing.find((row) => text(row, "id") === change.id);
      if (prev)
        version.run(
          crypto.randomUUID(),
          change.id,
          text(prev, "title"),
          text(prev, "body"),
          text(prev, "fields"),
          "sync",
          now,
        );
      const entry = change.entry;
      update.run(
        entry.type,
        entry.title,
        entry.body,
        JSON.stringify(entry.fields),
        JSON.stringify([...entry.tags].sort()),
        entry.pillar,
        sourceOf(entry.syncKey),
        now,
        change.id,
      );
      stats.updated += 1;
    }
    for (const key of plan.retire) {
      const result = retire.run(now, projectId, key);
      stats.retired += result.changes;
    }
    const current = sqlite
      .prepare(`SELECT file, message FROM kb_sync_warnings WHERE project_id=? ORDER BY file, message`)
      .all(projectId) as { file: string; message: string }[];
    const next = [...warnings].sort((a, b) => `${a.file}${a.message}`.localeCompare(`${b.file}${b.message}`));
    const same =
      current.length === next.length &&
      current.every((row, i) => row.file === next[i].file && row.message === next[i].message);
    if (!same) {
      sqlite.prepare(`DELETE FROM kb_sync_warnings WHERE project_id=?`).run(projectId);
      const add = sqlite.prepare(
        `INSERT INTO kb_sync_warnings (id, project_id, file, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const warning of next) add.run(crypto.randomUUID(), projectId, warning.file, warning.message, now);
    }
  });
  write();
  return stats;
}

function sourceOf(syncKey: string): string {
  if (syncKey.startsWith("knowledge_base")) return "synced:knowledge_base";
  if (syncKey.startsWith("lib/")) return `synced:${syncKey.split("#")[0]}`;
  const file = syncKey.split("#")[0];
  return `synced:${file}`;
}

export function searchEntries(
  sqlite: Database.Database,
  projectId: string,
  query: string,
  opts: { types?: string[]; status?: string; limit?: number; mode?: "and" | "or" } = {},
): HubRow[] {
  const match = ftsQuery(query, opts.mode ?? "and");
  if (!match) return [];
  const types = opts.types?.length ? JSON.stringify(opts.types) : "[]";
  const status = opts.status ?? "active";
  try {
    const rows = sqlite
      .prepare(
        `SELECT e.* FROM kb_fts
         JOIN kb_entries e ON e.rowid = kb_fts.rowid
         WHERE kb_fts MATCH ?
           AND e.project_id = ?
           AND e.status = ?
           AND (? = '[]' OR e.type IN (SELECT value FROM json_each(?)))
         ORDER BY bm25(kb_fts, 8.0, 1.0, 4.0)
         LIMIT ?`,
      )
      .all(match, projectId, status, types, types, opts.limit ?? 20) as Raw[];
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export function listEntries(
  sqlite: Database.Database,
  projectId: string,
  opts: { type?: string; status?: string; limit?: number } = {},
): HubRow[] {
  const rows = sqlite
    .prepare(
      `SELECT * FROM kb_entries
       WHERE project_id = ?
         AND status = ?
         AND (? = '' OR type = ?)
       ORDER BY title COLLATE NOCASE
       LIMIT ?`,
    )
    .all(projectId, opts.status ?? "active", opts.type ?? "", opts.type ?? "", opts.limit ?? 80) as Raw[];
  return rows.map(mapRow);
}

export function countTypes(sqlite: Database.Database, projectId: string): { type: string; n: number }[] {
  return sqlite
    .prepare(
      `SELECT type, count(*) AS n FROM kb_entries
       WHERE project_id = ? AND status = 'active' GROUP BY type ORDER BY type`,
    )
    .all(projectId) as { type: string; n: number }[];
}

export function readEntry(sqlite: Database.Database, projectId: string, id: string): HubRow | null {
  const row = sqlite.prepare(`SELECT * FROM kb_entries WHERE id = ? AND project_id = ?`).get(id, projectId) as
    | Raw
    | undefined;
  return row ? mapRow(row) : null;
}

export function entryVersions(sqlite: Database.Database, entryId: string) {
  return sqlite
    .prepare(
      `SELECT id, title, body, editor, created_at AS createdAt FROM kb_versions
       WHERE entry_id = ? ORDER BY created_at DESC LIMIT 12`,
    )
    .all(entryId) as { id: string; title: string | null; body: string; editor: string | null; createdAt: number | null }[];
}

export function entryPosts(sqlite: Database.Database, entryId: string) {
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.headline, p.insights_json AS insightsJson, l.how
       FROM post_kb_links l JOIN generated_posts p ON p.id = l.post_id
       WHERE l.entry_id = ?`,
    )
    .all(entryId) as { id: string; headline: string | null; insightsJson: string | null; how: string }[];
  let best: number | null = null;
  for (const row of rows) {
    const reach = reachOf(row.insightsJson);
    if (reach != null && (best == null || reach > best)) best = reach;
  }
  return {
    posts: rows.map((row) => ({ id: row.id, headline: row.headline, how: row.how })),
    bestReach: best,
  };
}

function reachOf(json: string | null): number | null {
  try {
    const reach = (JSON.parse(json || "{}") as { metrics?: { reach?: unknown } }).metrics?.reach;
    return typeof reach === "number" ? reach : null;
  } catch {
    return null;
  }
}

export function linksForPost(sqlite: Database.Database, postId: string) {
  return sqlite
    .prepare(
      `SELECT e.id, e.title, e.type FROM post_kb_links l
       JOIN kb_entries e ON e.id = l.entry_id
       WHERE l.post_id = ? ORDER BY e.title COLLATE NOCASE`,
    )
    .all(postId) as { id: string; title: string; type: string }[];
}

export function hubHealth(sqlite: Database.Database, projectId: string, now = Date.now()) {
  const cutoff = now - 60 * 86400000;
  const factsNoSource =
    (
      sqlite
        .prepare(
          `SELECT count(*) AS n FROM kb_entries
           WHERE project_id=? AND type='fact' AND status='active'
             AND (json_extract(fields, '$.source') IS NULL OR json_extract(fields, '$.source') = '')`,
        )
        .get(projectId) as { n: number }
    ).n ?? 0;
  const pillars = sqlite
    .prepare(`SELECT title FROM kb_entries WHERE project_id=? AND type='pillar' AND status='active'`)
    .all(projectId) as { title: string }[];
  const covered = new Set(
    (
      sqlite
        .prepare(
          `SELECT pillar FROM kb_entries
           WHERE project_id=? AND type='example' AND status='active' AND pillar IS NOT NULL`,
        )
        .all(projectId) as { pillar: string }[]
    ).map((row) => row.pillar),
  );
  const warnings = sqlite
    .prepare(`SELECT file, message FROM kb_sync_warnings WHERE project_id=? ORDER BY file`)
    .all(projectId) as HubWarning[];
  const unused =
    (
      sqlite
        .prepare(
          `SELECT count(*) AS n FROM kb_entries
           WHERE project_id=? AND status='active'
             AND ((last_used_at IS NOT NULL AND last_used_at < ?) OR (last_used_at IS NULL AND created_at < ?))`,
        )
        .get(projectId, cutoff, cutoff) as { n: number }
    ).n ?? 0;
  const drafts =
    (sqlite.prepare(`SELECT count(*) AS n FROM kb_entries WHERE project_id=? AND status='draft'`).get(projectId) as { n: number })
      .n ?? 0;
  return {
    factsNoSource,
    pillarsWithoutExamples: pillars.map((row) => row.title).filter((title) => !covered.has(title)),
    warnings,
    unused,
    drafts,
  };
}

export function recordTaste(
  sqlite: Database.Database,
  input: {
    projectId: string;
    title: string;
    what: string;
    verdict: string;
    reason: string;
    before?: string;
    after?: string;
  },
) {
  const now = Date.now();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUEUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  sqlite
    .prepare(
      `INSERT INTO kb_entries
        (id, project_id, type, title, body, fields, tags, status, source, created_at, updated_at, use_count)
       VALUES (?, ?, 'taste', ?, ?, ?, '["taste"]', 'draft', 'owner', ?, ?, 0)`,
    )
    .run(
      crypto.randomUUID(),
      input.projectId,
      input.title.slice(0, 180),
      [input.before, input.after].filter(Boolean).join("\n\n"),
      JSON.stringify({
        date,
        what: input.what,
        verdict: input.verdict,
        reason: input.reason,
        before: input.before ?? "",
        after: input.after ?? "",
      }),
      now,
      now,
    );
}

export function setEntryStatus(sqlite: Database.Database, projectId: string, id: string, status: "active" | "retired") {
  const entry = readEntry(sqlite, projectId, id);
  if (!entry) throw new Error("Entry not found");
  if (entry.source.startsWith("synced:") && status === "retired" && entry.status !== "draft")
    throw new Error("Synced entries are edited in the doc.");
  sqlite.prepare(`UPDATE kb_entries SET status=?, updated_at=? WHERE id=?`).run(status, Date.now(), id);
}

export function createEntry(
  sqlite: Database.Database,
  projectId: string,
  input: { type: KbType; title: string; body: string; fields: HubFields; tags: string[]; pillar: string | null },
) {
  const now = Date.now();
  const id = crypto.randomUUID();
  sqlite
    .prepare(
      `INSERT INTO kb_entries
        (id, project_id, type, title, body, fields, tags, pillar, status, source, created_at, updated_at, use_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'owner', ?, ?, 0)`,
    )
    .run(
      id,
      projectId,
      input.type,
      input.title,
      input.body,
      JSON.stringify(input.fields),
      JSON.stringify(input.tags),
      input.pillar,
      now,
      now,
    );
  return id;
}

export function updateEntry(
  sqlite: Database.Database,
  projectId: string,
  id: string,
  input: { title: string; body: string; fields: HubFields; tags: string[]; pillar: string | null },
  editor: string,
) {
  const entry = readEntry(sqlite, projectId, id);
  if (!entry) throw new Error("Entry not found");
  if (entry.source.startsWith("synced:")) throw new Error("This entry is synced from a doc. Edit the doc.");
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO kb_versions (id, entry_id, title, body, fields, editor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(crypto.randomUUID(), id, entry.title, entry.body, JSON.stringify(entry.fields), editor, now);
  sqlite
    .prepare(`UPDATE kb_entries SET title=?, body=?, fields=?, tags=?, pillar=?, updated_at=? WHERE id=?`)
    .run(input.title, input.body, JSON.stringify(input.fields), JSON.stringify(input.tags), input.pillar, now, id);
}

export function restoreVersion(sqlite: Database.Database, projectId: string, entryId: string, versionId: string) {
  const entry = readEntry(sqlite, projectId, entryId);
  if (!entry) throw new Error("Entry not found");
  if (entry.source.startsWith("synced:")) throw new Error("This entry is synced from a doc. Edit the doc.");
  const version = sqlite.prepare(`SELECT title, body, fields FROM kb_versions WHERE id=? AND entry_id=?`).get(versionId, entryId) as
    | { title: string | null; body: string; fields: string | null }
    | undefined;
  if (!version) throw new Error("That version is gone");
  updateEntry(
    sqlite,
    projectId,
    entryId,
    {
      title: version.title || entry.title,
      body: version.body,
      fields: fieldsOf(version.fields ?? "{}"),
      tags: entry.tags,
      pillar: entry.pillar,
    },
    "restore",
  );
}

const LINK_TYPES = new Set(["fact", "myth", "founder_story", "hook", "example"]);

function linkHow(type: string): "fact" | "example" | "hook" | null {
  if (type === "fact" || type === "myth") return "fact";
  if (type === "hook") return "hook";
  if (type === "founder_story" || type === "example") return "example";
  return null;
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      (value.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? []).filter(
        (token) => (token.length >= 5 || /\d/.test(token)) && !STOP.has(token),
      ),
    ),
  ];
}

export function linkCaption(sqlite: Database.Database, projectId: string, postId: string, caption: string) {
  const words = tokens(caption).slice(0, 8);
  const wanted = new Map<string, "fact" | "example" | "hook">();
  if (words.length) {
    const hits = searchEntries(sqlite, projectId, words.join(" "), { limit: 24, mode: "or" });
    const captionTokens = new Set(tokens(caption));
    for (const hit of hits) {
      if (!LINK_TYPES.has(hit.type)) continue;
      const how = linkHow(hit.type);
      if (!how) continue;
      const overlap = tokens(`${hit.title} ${hit.body}`).some((token) => captionTokens.has(token));
      if (overlap) wanted.set(`${hit.id}:${how}`, how);
      if (wanted.size >= 6) break;
    }
  }
  const current = sqlite
    .prepare(`SELECT entry_id, how FROM post_kb_links WHERE post_id=?`)
    .all(postId) as { entry_id: string; how: string }[];
  const currentKey = current
    .map((row) => `${row.entry_id}:${row.how}`)
    .sort()
    .join("|");
  const next = [...wanted.keys()].sort();
  if (currentKey === next.join("|")) return next.length;
  sqlite.prepare(`DELETE FROM post_kb_links WHERE post_id=?`).run(postId);
  const add = sqlite.prepare(
    `INSERT INTO post_kb_links (id, post_id, entry_id, how, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const touch = sqlite.prepare(`UPDATE kb_entries SET last_used_at=? WHERE id=?`);
  const now = Date.now();
  for (const key of next) {
    const split = key.lastIndexOf(":");
    const entryId = key.slice(0, split);
    const how = key.slice(split + 1);
    add.run(crypto.randomUUID(), postId, entryId, how, now);
    touch.run(now, entryId);
  }
  return next.length;
}

export function relinkProject(sqlite: Database.Database, projectId: string) {
  const posts = sqlite
    .prepare(`SELECT id, caption, hashtags FROM generated_posts WHERE project_id=? AND caption IS NOT NULL AND caption != ''`)
    .all(projectId) as { id: string; caption: string; hashtags: string | null }[];
  let linked = 0;
  for (const post of posts) {
    linked += linkCaption(sqlite, projectId, post.id, [post.caption, post.hashtags].filter(Boolean).join("\n\n"));
  }
  return linked;
}

export function entriesByType(sqlite: Database.Database, projectId: string, types: string[], limit: number): HubRow[] {
  if (!types.length) return [];
  const rows = sqlite
    .prepare(
      `SELECT * FROM kb_entries
       WHERE project_id=? AND status='active' AND type IN (SELECT value FROM json_each(?))
       ORDER BY type, title COLLATE NOCASE LIMIT ?`,
    )
    .all(projectId, JSON.stringify(types), limit) as Raw[];
  return rows.map(mapRow);
}

export function recentTaste(sqlite: Database.Database, projectId: string, limit = 5): HubRow[] {
  const rows = sqlite
    .prepare(
      `SELECT * FROM kb_entries WHERE project_id=? AND type='taste' AND status='active'
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(projectId, limit) as Raw[];
  return rows.map(mapRow);
}

export function matchingExamples(
  sqlite: Database.Database,
  projectId: string,
  opts: { format?: string; pillar?: string },
): HubRow[] {
  const format = opts.format ?? "";
  const pillar = opts.pillar ?? "";
  const rows = sqlite
    .prepare(
      `SELECT * FROM kb_entries
       WHERE project_id=? AND type='example' AND status='active'
         AND (
           (? = '' AND ? = '')
           OR (? != '' AND pillar = ?)
           OR (? != '' AND json_extract(fields, '$.format') = ?)
         )
       ORDER BY use_count DESC, updated_at DESC
       LIMIT 3`,
    )
    .all(projectId, format, pillar, pillar, pillar, format, format) as Raw[];
  return rows.map(mapRow);
}

export function exportableEntries(sqlite: Database.Database, projectId: string): HubRow[] {
  const rows = sqlite
    .prepare(
      `SELECT * FROM kb_entries
       WHERE project_id=? AND source IN ('owner', 'claude')
         AND type IN ('taste', 'hook', 'example', 'note')
         AND status != 'retired'
       ORDER BY type, updated_at DESC`,
    )
    .all(projectId) as Raw[];
  return rows.map(mapRow);
}
