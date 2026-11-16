import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { HubEntryDraft } from "@/lib/kb-types";
import { applySync, recordTaste, searchEntries } from "@/lib/kb-store";

function memoryDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE projects (id text primary key, name text not null);
    CREATE TABLE generated_posts (
      id text primary key,
      project_id text,
      caption text,
      hashtags text,
      headline text,
      insights_json text
    );
  `);
  const sql = readFileSync("drizzle/migrations/0014_kb_hub.sql", "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
  sqlite.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run("p1", "Test");
  return sqlite;
}

function fact(syncKey: string, title: string, claim: string, numbers: string[]): HubEntryDraft {
  return {
    syncKey,
    type: "fact",
    title,
    body: claim,
    fields: { claim, allowedNumbers: numbers, source: "facts.md" },
    tags: [],
    pillar: null,
  };
}

const ENTRIES: HubEntryDraft[] = [
  fact("docs/facts.md#oven", "Oven runs at 250 degrees", "The oven runs at 250 degrees.", ["250"]),
  fact("docs/facts.md#proof", "Dough proofs for 2.5 hours", "Each loaf rests for 2.5 hours.", ["2.5"]),
  fact("docs/team.md#bakers", "Four bakers", "Four bakers start at 4 in the morning.", ["4"]),
];
const PREFIXES = ["docs/facts.md", "docs/team.md"];

describe("hub sync and search", () => {
  it("changes nothing on a second run and finds a fact quickly", () => {
    const sqlite = memoryDb();
    const first = applySync(sqlite, "p1", ENTRIES, PREFIXES, []);
    expect(first.inserted).toBe(ENTRIES.length);
    const before = sqlite.prepare(`SELECT id, title, status, updated_at, body FROM kb_entries ORDER BY source_ref`).all();
    const second = applySync(sqlite, "p1", ENTRIES, PREFIXES, []);
    const after = sqlite.prepare(`SELECT id, title, status, updated_at, body FROM kb_entries ORDER BY source_ref`).all();
    expect(second).toMatchObject({ inserted: 0, updated: 0, retired: 0 });
    expect(after).toEqual(before);

    const started = Date.now();
    const hits = searchEntries(sqlite, "p1", "oven 250", { limit: 10 });
    expect(Date.now() - started).toBeLessThan(100);
    const found = hits.find((hit) => hit.type === "fact" && hit.title.startsWith("Oven runs at 250"));
    expect(found?.sourceRef).toContain("facts.md");
    expect(found?.fields.source).toBe("facts.md");
  });

  it("retires a synced row whose source line disappeared", () => {
    const sqlite = memoryDb();
    applySync(sqlite, "p1", ENTRIES, PREFIXES, []);
    const kept = ENTRIES.filter((entry) => !entry.syncKey.includes("team.md"));
    const result = applySync(sqlite, "p1", kept, PREFIXES, []);
    expect(result.retired).toBe(1);
    const retired = sqlite
      .prepare(`SELECT count(*) AS n FROM kb_entries WHERE status = 'retired' AND source_ref LIKE '%team.md%'`)
      .get() as { n: number };
    expect(retired.n).toBe(1);
  });

  it("records a declined caption as a taste draft", () => {
    const sqlite = memoryDb();
    recordTaste(sqlite, {
      projectId: "p1",
      title: "Declined: Spring menu",
      what: "Spring menu",
      verdict: "declined",
      reason: "",
      before: "The old caption",
    });
    const row = sqlite
      .prepare(`SELECT status, source, type, title FROM kb_entries WHERE type = 'taste'`)
      .get() as { status: string; source: string; type: string; title: string };
    expect(row).toMatchObject({ status: "draft", source: "owner", type: "taste", title: "Declined: Spring menu" });
  });
});
