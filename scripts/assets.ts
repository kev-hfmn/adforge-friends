// The asset library from the command line: find screenshots for a post without asking the owner,
// or add a batch. Same code as the Library page (lib/assets.ts).
//
// Run from the repo root: set -a && . ./.env.local && set +a && npx tsx scripts/assets.ts <command>
//
//   list [--project <id|name>] [--kind screenshot|photo|chart|clip] [--feature Onboarding] [--tag dark-mode]
//   add <file> [<file> ...] [--project x] [--kind k] [--feature F] [--tags a,b] [--date YYYY-MM-DD] [--note "..."]
//   label <assetId> [--kind k] [--feature F] [--tags a,b] [--date YYYY-MM-DD] [--note "..."]
// Paths printed by `list` are public paths (/uploads/<project>/<file>); on disk they sit under public/.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets } from "@/drizzle/schema";
import { addAsset, dayText, listAssets, parseDay, updateAsset } from "@/lib/assets";

const VALUE_FLAGS = ["project", "kind", "feature", "tag", "tags", "date", "note"];
function parse(args: string[]) {
  const flags: Record<string, string> = {}, rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith("--") ? args[i].slice(2) : null;
    if (name && VALUE_FLAGS.includes(name)) flags[name] = args[++i] ?? "";
    else rest.push(args[i]);
  }
  return { flags, rest };
}
async function projectId(want: string | undefined): Promise<string> {
  const projects = await db.query.projects.findMany();
  const project = want
    ? projects.find((p) => p.id === want || p.name.toLowerCase() === want.toLowerCase())
    : projects.length === 1 ? projects[0] : undefined;
  if (!project) throw new Error(`--project needed, one of: ${projects.map((p) => p.name).join(", ")}`);
  return project.id;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { flags, rest } = parse(args);
  const details = {
    kind: flags.kind,
    feature: flags.feature,
    tags: flags.tags,
    capturedAt: parseDay(flags.date),
    note: flags.note,
  };
  if (flags.date && !details.capturedAt) throw new Error("--date is YYYY-MM-DD");
  if (command === "list") {
    const found = await listAssets(await projectId(flags.project), { kind: flags.kind, feature: flags.feature, tag: flags.tag });
    for (const a of found)
      console.log(`${a.id}  ${dayText(a.capturedAt)}  ${(a.kind ?? "").padEnd(10)} ${(a.feature ?? "").padEnd(20)} ${a.tags.map((t) => "#" + t).join(" ").padEnd(28)} ${a.path}${a.note ? "  // " + a.note : ""}`);
    console.log(found.length ? `${found.length} files` : "nothing matches");
  } else if (command === "add") {
    if (!rest.length) throw new Error("usage: assets.ts add <file> [<file> ...] [--feature F] [--tags a,b] [--date YYYY-MM-DD]");
    const id = await projectId(flags.project);
    for (const file of rest) {
      const asset = await addAsset(id, { name: basename(file), data: readFileSync(file) }, details);
      console.log(`added ${asset.id}  ${asset.path}`);
    }
  } else if (command === "label") {
    const asset = rest[0] ? await db.query.assets.findFirst({ where: eq(assets.id, rest[0]) }) : undefined;
    if (!asset) throw new Error("usage: assets.ts label <assetId> [--feature F] [--tags a,b] ...");
    await updateAsset(asset.id, asset.projectId, {
      ...(flags.kind ? { kind: flags.kind } : {}),
      ...(flags.feature !== undefined ? { feature: flags.feature } : {}),
      ...(flags.tags !== undefined ? { tags: flags.tags } : {}),
      ...(details.capturedAt ? { capturedAt: details.capturedAt } : {}),
      ...(flags.note !== undefined ? { note: flags.note } : {}),
    });
    console.log("labels saved");
  } else {
    throw new Error("usage: assets.ts list | add <file...> | label <assetId>  (see the top of this file)");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERR", e?.message ?? e); process.exit(1); });
