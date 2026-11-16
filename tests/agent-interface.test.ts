import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { toolCatalog, toolNames, toolWordHits } from "@/lib/api/catalog";
import { mondayOf, shiftDay } from "@/lib/plan";
import { localInput } from "@/lib/queue-schedule";

const root = mkdtempSync(path.join(tmpdir(), "adforge-agent-"));
const dbFile = path.join(root, "db.sqlite");
process.env.ADFORGE_DB = dbFile;

const PROJECT = "proj-test";
const future = Date.now() + 3 * 24 * 60 * 60 * 1000;
const nextWeek = future + 7 * 24 * 60 * 60 * 1000;
const WEEK = mondayOf(localInput(future).slice(0, 10));

function setupDb() {
  const db = new Database(dbFile);
  db.exec(`
    CREATE TABLE projects (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text,
      brand_color text,
      logo_path text,
      rhythm_json text,
      copy_mode text,
      bio_link text,
      created_at integer,
      updated_at integer
    );
    CREATE TABLE generated_posts (
      id text PRIMARY KEY,
      project_id text,
      status text,
      template_type text,
      headline text,
      headline_highlight text,
      subtext text,
      bold_phrases text,
      caption text,
      hashtags text,
      background_preset text,
      layout_style text,
      metadata text,
      image_path text,
      video_path text,
      background_image_url text,
      carousel_slides text,
      targeting_context text,
      palette text,
      image_mode text,
      image_prompt text,
      fal_source_url text,
      source text,
      ig_media_id text,
      posted_at integer,
      scheduled_at integer,
      permalink text,
      publish_error text,
      insights_json text,
      insights_updated_at integer,
      created_at integer
    );
    CREATE TABLE audit_log (
      id text PRIMARY KEY,
      project_id text,
      actor text NOT NULL,
      action text NOT NULL,
      target text NOT NULL,
      before_summary text,
      after_summary text,
      quote text,
      created_at integer
    );
  `);
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(PROJECT, "Test");
  const insert = db.prepare(
    `INSERT INTO generated_posts
      (id, project_id, status, template_type, headline, caption, image_path, scheduled_at, source)
     VALUES (?, ?, ?, 'reel', ?, ?, '/generated/test.png', ?, 'manual')`,
  );
  insert.run("post-timed", PROJECT, "pending", "Timed", "A quiet day at the bakery.", future);
  insert.run("post-nextweek", PROJECT, "pending", "Next week", "A quiet day at the bakery.", nextWeek);
  insert.run("post-notime", PROJECT, "pending", "No time", "A quiet day at the bakery.", null);
  insert.run("post-approved", PROJECT, "approved", "Approved", "A quiet day at the bakery.", future);
  db.close();
}

function readPost(id: string) {
  const db = new Database(dbFile);
  const row = db.prepare(`SELECT status, caption FROM generated_posts WHERE id = ?`).get(id) as {
    status: string;
    caption: string;
  };
  db.close();
  return row;
}

setupDb();

describe("agent interface", () => {
  let api: typeof import("@/lib/api");

  beforeAll(async () => {
    vi.resetModules();
    api = await import("@/lib/api");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("lists the tools and fails if any name or description can send, remove, or read a credential", () => {
    expect(toolCatalog.length).toBe(toolNames.length);
    expect(toolWordHits()).toEqual([]);
    expect(toolNames).toContain("approve_week");
    expect(toolNames.some((name) => /publish|delete|token|secret|password/i.test(name))).toBe(false);
    const source = fs.readFileSync("mcp/adforge-server.ts", "utf8");
    expect(source).toContain("toolCatalog");
    expect(source).not.toMatch(/registerTool\(\s*["'`]/);
  });

  it("registers the same tools the server is allowed to call", () => {
    expect(Object.keys(api.agentHandlers).sort()).toEqual([...toolNames].sort());
  });

  it("refuses approve_week without ownerSaid and does not save a blocked caption as approved copy", async () => {
    await expect(api.agentHandlers.approve_week({ projectId: PROJECT, weekStart: WEEK, ownerSaid: "" })).rejects.toThrow(/owner/);
    await expect(api.agentHandlers.approve_week({ projectId: PROJECT, weekStart: WEEK, ownerSaid: "   " })).rejects.toThrow(/owner/);
    expect(readPost("post-timed").status).toBe("pending");
    expect(readPost("post-notime").status).toBe("pending");

    await expect(
      api.agentHandlers.post_update_copy({
        projectId: PROJECT,
        postId: "post-approved",
        caption: "A quiet day \u2014 still quiet.",
        asDraft: false,
      }),
    ).rejects.toThrow(/approved copy/);
    const kept = readPost("post-approved");
    expect(kept.status).toBe("approved");
    expect(kept.caption).toBe("A quiet day at the bakery.");

    const drafted = (await api.agentHandlers.post_update_copy({
      projectId: PROJECT,
      postId: "post-approved",
      caption: "A quiet day \u2014 still quiet.",
      asDraft: true,
    })) as { status: string };
    expect(drafted.status).toBe("draft");
    expect(readPost("post-approved").status).not.toBe("approved");
  });

  it("stores ownerSaid and still refuses a post with no time", async () => {
    await expect(
      api.agentHandlers.approve_week({ projectId: PROJECT, ownerSaid: "Yes, this week is fine." }),
    ).rejects.toThrow(/weekStart/);
    await expect(
      api.agentHandlers.approve_week({ projectId: PROJECT, weekStart: shiftDay(WEEK, 1), ownerSaid: "Yes, this week is fine." }),
    ).rejects.toThrow(/Monday/);
    expect(readPost("post-timed").status).toBe("pending");
    const result = (await api.agentHandlers.approve_week({
      projectId: PROJECT,
      weekStart: WEEK,
      ownerSaid: "Yes, this week is fine.",
    })) as {
      approved: { id: string }[];
      refused: { id: string }[];
      skipped: { id: string }[];
      quoteStored: boolean;
    };
    expect(result.quoteStored).toBe(true);
    expect(result.skipped.map((item) => item.id)).toEqual(["post-nextweek"]);
    expect(readPost("post-nextweek").status).toBe("pending");
    expect(result.approved.map((item) => item.id)).toContain("post-timed");
    expect(result.refused.map((item) => item.id)).toContain("post-notime");
    expect(readPost("post-notime").status).toBe("pending");
    expect(readPost("post-timed").status).toBe("approved");
    const db = new Database(dbFile);
    const row = db.prepare(`SELECT quote FROM audit_log WHERE action = 'approve_week'`).get() as { quote: string };
    db.close();
    expect(row.quote).toBe("Yes, this week is fine.");
  });
});
