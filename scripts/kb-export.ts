// Write the owner's and Claude's own hub entries to markdown files under
// exports/hub/, so a Claude session can grep them.
//
//   npx tsx scripts/kb-export.ts --project <projectId>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { projects } from "@/drizzle/schema";
import { exportableEntries } from "@/lib/kb-store";

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const projectId = flag(process.argv.slice(2), "project");
  if (!projectId) throw new Error("Usage: npx tsx scripts/kb-export.ts --project <projectId>");
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new Error(`No project ${projectId}`);
  const rows = exportableEntries(sqlite, projectId);
  const dir = join(process.cwd(), "exports/hub", projectId);
  mkdirSync(dir, { recursive: true });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = groups.get(row.type) ?? [];
    list.push(row);
    groups.set(row.type, list);
  }
  if (!rows.length) {
    console.log("[kb-export] no owner or Claude entries to write");
    return;
  }
  for (const [type, entries] of groups) {
    const body = [
      `# ${type}`,
      "",
      `Exported from the hub for ${project.name}. Synced docs are not included.`,
      "",
      ...entries.flatMap((entry) => [
        `## ${entry.title}`,
        "",
        entry.body || "(empty)",
        "",
        entry.status === "draft" ? "Status: draft, not confirmed yet." : `Status: ${entry.status}.`,
        "",
      ]),
    ].join("\n");
    const path = join(dir, `${type}.md`);
    writeFileSync(path, body);
    console.log(`[kb-export] ${path} (${entries.length})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
