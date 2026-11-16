// Idea rows. Callers pass a database. Nothing here publishes or approves a post.
import type Database from "better-sqlite3";
import { futureTime } from "./queue-rules";
import { postLabel, type QueuePost } from "./queue-view";
import type { WeeklySlot } from "./queue-schedule";
import {
  isIdeaStatus,
  offeredSlotForFormat,
  parseLinks,
  shapeForFormat,
  takeawayDraft,
  type IdeaLinks,
  type IdeaStatus,
} from "./ideas";

export type IdeaRecord = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  pillar: string | null;
  format: string | null;
  tags: string[];
  status: IdeaStatus;
  links: IdeaLinks;
  createdBy: "owner" | "claude";
  dueWeek: string | null;
  postId: string | null;
  createdAt: number | null;
};

type IdeaRow = {
  id: string;
  project_id: string;
  title: string;
  body: string | null;
  pillar: string | null;
  format: string | null;
  tags: string | null;
  status: string;
  links: string | null;
  created_by: string;
  due_week: string | null;
  post_id: string | null;
  created_at: number | null;
};

function asTags(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function asRecord(row: IdeaRow): IdeaRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    body: row.body ?? "",
    pillar: row.pillar,
    format: row.format,
    tags: asTags(row.tags),
    status: isIdeaStatus(row.status) ? row.status : "inbox",
    links: parseLinks(row.links),
    createdBy: row.created_by === "claude" ? "claude" : "owner",
    dueWeek: row.due_week,
    postId: row.post_id,
    createdAt: row.created_at,
  };
}

export function listIdeas(db: Database.Database, projectId: string): IdeaRecord[] {
  const rows = db
    .prepare(
      `SELECT id, project_id, title, body, pillar, format, tags, status, links, created_by,
              due_week, post_id, created_at
       FROM ideas WHERE project_id = ? ORDER BY created_at DESC, title COLLATE NOCASE`,
    )
    .all(projectId) as IdeaRow[];
  return rows.map(asRecord);
}

export function countIdeas(db: Database.Database, projectId: string, status?: IdeaStatus): number {
  try {
    const row = (
      status
        ? db.prepare(`SELECT count(*) AS n FROM ideas WHERE project_id = ? AND status = ?`).get(projectId, status)
        : db.prepare(`SELECT count(*) AS n FROM ideas WHERE project_id = ?`).get(projectId)
    ) as { n: number } | undefined;
    return row?.n ?? 0;
  } catch (error) {
    if (/no such table/i.test(String(error))) return 0;
    throw error;
  }
}

export function readIdea(db: Database.Database, projectId: string, ideaId: string): IdeaRecord | null {
  const row = db
    .prepare(
      `SELECT id, project_id, title, body, pillar, format, tags, status, links, created_by,
              due_week, post_id, created_at
       FROM ideas WHERE id = ? AND project_id = ?`,
    )
    .get(ideaId, projectId) as IdeaRow | undefined;
  return row ? asRecord(row) : null;
}

function assertProject(db: Database.Database, projectId: string) {
  const project = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(projectId);
  if (!project) throw new Error("Project not found");
}

export function createIdea(
  db: Database.Database,
  input: {
    projectId: string;
    title: string;
    body?: string | null;
    pillar?: string | null;
    format?: string | null;
    tags?: string[];
    status?: IdeaStatus;
    links?: IdeaLinks;
    createdBy?: "owner" | "claude";
    dueWeek?: string | null;
    postId?: string | null;
  },
): string {
  assertProject(db, input.projectId);
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Name the idea");
  const id = crypto.randomUUID();
  const now = Date.now();
  const links = input.links ?? { urls: [], assetIds: [], sourcePostId: null };
  db.prepare(
    `INSERT INTO ideas
      (id, project_id, title, body, pillar, format, tags, status, links, created_by, due_week, post_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.projectId,
    title,
    (input.body ?? "").trim(),
    input.pillar?.trim() || null,
    input.format?.trim() || null,
    JSON.stringify(input.tags ?? []),
    input.status ?? "inbox",
    JSON.stringify(links),
    input.createdBy ?? "owner",
    input.dueWeek ?? null,
    input.postId ?? null,
    now,
    now,
  );
  return id;
}

export function moveIdea(
  db: Database.Database,
  projectId: string,
  ideaId: string,
  status: IdeaStatus,
): boolean {
  const result = db
    .prepare(`UPDATE ideas SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?`)
    .run(status, Date.now(), ideaId, projectId);
  return result.changes > 0;
}

export function turnIdeaIntoPost(
  db: Database.Database,
  projectId: string,
  ideaId: string,
  posts: readonly QueuePost[],
  now: number,
  rhythm: readonly WeeklySlot[],
): { postId: string; offeredAt: number; created: boolean } {
  const idea = readIdea(db, projectId, ideaId);
  if (!idea) throw new Error("That idea is not in this project");
  const offeredAt = offeredSlotForFormat(idea.format, posts, now, rhythm);
  if (idea.postId) {
    const owns = db
      .prepare(`SELECT id FROM generated_posts WHERE id = ? AND project_id = ?`)
      .get(idea.postId, projectId) as { id: string } | undefined;
    if (owns) return { postId: idea.postId, offeredAt, created: false };
  }
  const postId = crypto.randomUUID();
  const shape = shapeForFormat(idea.format);
  const caption = idea.links.sourceKey ? "" : idea.body.slice(0, 2200);
  db.prepare(
    `INSERT INTO generated_posts
      (id, project_id, status, template_type, headline, caption, layout_style, metadata, source, scheduled_at, created_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, 'manual', NULL, ?)`,
  ).run(
    postId,
    projectId,
    shape.templateType,
    idea.title.slice(0, 120),
    caption,
    shape.layoutStyle,
    JSON.stringify({ ideaId: idea.id }),
    now,
  );
  db.prepare(`UPDATE ideas SET post_id = ?, status = 'planned', updated_at = ? WHERE id = ? AND project_id = ?`).run(
    postId,
    now,
    idea.id,
    projectId,
  );
  return { postId, offeredAt, created: true };
}

/** Put a draft into review at the offered slot. Does not approve it. */
export function proposeDraftSlot(
  db: Database.Database,
  projectId: string,
  postId: string,
  at: number,
  now: number,
): number {
  const time = futureTime(at, now);
  const result = db
    .prepare(
      `UPDATE generated_posts SET status = 'pending', scheduled_at = ?
       WHERE id = ? AND project_id = ? AND status = 'draft'`,
    )
    .run(time, postId, projectId);
  if (result.changes < 1) throw new Error("Only a draft can take this time");
  return time;
}

export function ideaFromTakeaway(
  db: Database.Database,
  projectId: string,
  postId: string,
  mode: "reel" | "again",
): string {
  const post = db
    .prepare(
      `SELECT id, project_id AS projectId, status, template_type AS templateType, layout_style AS layoutStyle,
              metadata, headline, caption
       FROM generated_posts WHERE id = ? AND project_id = ?`,
    )
    .get(postId, projectId) as QueuePost | undefined;
  if (!post) throw new Error("That post is not in this project");
  const sourceKey = `results:${postId}:${mode}`;
  const existing = db
    .prepare(`SELECT id FROM ideas WHERE project_id = ? AND json_extract(links, '$.sourceKey') = ?`)
    .get(projectId, sourceKey) as { id: string } | undefined;
  if (existing) return existing.id;
  const draft = takeawayDraft(postLabel(post), mode);
  return createIdea(db, {
    projectId,
    title: draft.title,
    body: draft.body,
    format: draft.format,
    status: "inbox",
    createdBy: "owner",
    links: { urls: [], assetIds: [], sourcePostId: postId, sourceKey },
    tags: ["results"],
  });
}
