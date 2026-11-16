import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { countIdeas, turnIdeaIntoPost } from "@/lib/ideas-store";
import { localTimestamp, WEEKLY_SLOTS } from "@/lib/queue-schedule";
import type { QueuePost } from "@/lib/queue-view";

const PROJECT = "project-a";
const OTHER = "other-project";

function memory() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE projects (id text PRIMARY KEY, name text);
    CREATE TABLE ideas (
      id text PRIMARY KEY,
      project_id text NOT NULL,
      title text NOT NULL,
      body text,
      pillar text,
      format text,
      tags text,
      status text NOT NULL,
      links text,
      created_by text NOT NULL,
      due_week text,
      post_id text,
      created_at integer,
      updated_at integer
    );
    CREATE TABLE generated_posts (
      id text PRIMARY KEY,
      project_id text,
      status text,
      template_type text,
      headline text,
      caption text,
      layout_style text,
      metadata text,
      source text,
      scheduled_at integer,
      created_at integer
    );
  `);
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(PROJECT, "Project A");
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(OTHER, "Other");
  return db;
}

function approved(id: string, at: number): QueuePost {
  return {
    id,
    status: "approved",
    scheduledAt: at,
    templateType: "carousel",
    layoutStyle: null,
    metadata: null,
  } as QueuePost;
}

describe("ideas", () => {
  it("turns an idea into a draft at the next open slot and does not approve it", () => {
    const db = memory();
    const now = localTimestamp("2026-11-16T10:00");
    const monday = localTimestamp("2026-11-16T18:00");
    const wednesday = localTimestamp("2026-11-18T18:00");
    db.prepare(
      `INSERT INTO ideas (id, project_id, title, body, format, status, links, created_by, created_at, updated_at)
       VALUES ('idea-1', ?, 'Quiet hour', 'Notes', 'carousel', 'ready', '{}', 'owner', ?, ?)`,
    ).run(PROJECT, now, now);
    const result = turnIdeaIntoPost(db, PROJECT, "idea-1", [approved("taken", monday)], now, WEEKLY_SLOTS);
    const post = db.prepare(`SELECT status, scheduled_at AS scheduledAt FROM generated_posts WHERE id = ?`).get(
      result.postId,
    ) as { status: string; scheduledAt: number | null };
    const idea = db.prepare(`SELECT status, post_id AS postId, project_id AS projectId FROM ideas WHERE id = 'idea-1'`).get() as {
      status: string;
      postId: string;
      projectId: string;
    };
    expect(result.offeredAt).toBe(wednesday);
    expect(result.created).toBe(true);
    expect(post).toEqual({ status: "draft", scheduledAt: null });
    expect(idea).toMatchObject({ status: "planned", postId: result.postId, projectId: PROJECT });
    expect(countIdeas(db, OTHER)).toBe(0);
  });
});
