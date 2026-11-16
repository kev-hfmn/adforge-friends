// The asset library: reusable screenshots, photos, charts and clips, tagged by feature
// and date. The Library page, POST /api/assets and scripts/assets.ts all go through here.
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { assets, generatedPosts } from "@/drizzle/schema";

export const ASSET_KINDS = ["screenshot", "photo", "chart", "clip"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const KIND_NAMES: Record<AssetKind, string> = {
  screenshot: "Screenshots",
  photo: "Photos",
  chart: "Charts",
  clip: "Clips",
};
export type Asset = Omit<typeof assets.$inferSelect, "tags"> & { tags: string[] };

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};
export const assetMime = (path: string) => TYPES[extname(path).toLowerCase()];
export const isClip = (path: string) => /\.(mp4|mov)$/i.test(path);

/** "Onboarding, dark mode ,  " → ["onboarding", "dark mode"] */
export function parseTags(input: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(input) ? input : (input ?? "").split(",");
  return [
    ...new Set(
      parts.map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean),
    ),
  ].slice(0, 12);
}
/** "2026-11-10" → that day at noon UTC, so it shows as the same day everywhere. */
export function parseDay(input: string | null | undefined): number | null {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const at = Date.parse(`${input}T12:00:00Z`);
  return Number.isFinite(at) ? at : null;
}
export const dayText = (at: number | null | undefined) =>
  at == null ? "" : new Date(at).toISOString().slice(0, 10);

function row(a: typeof assets.$inferSelect): Asset {
  let tags: string[] = [];
  try {
    const value: unknown = JSON.parse(a.tags ?? "[]");
    if (Array.isArray(value)) tags = value.filter((t) => typeof t === "string");
  } catch {
    /* no tags */
  }
  return { ...a, tags };
}

export async function listAssets(
  projectId: string,
  filter: { kind?: string; tag?: string; feature?: string } = {},
): Promise<Asset[]> {
  let rows: (typeof assets.$inferSelect)[];
  try {
    rows = await db.query.assets.findMany({
      where: and(
        eq(assets.projectId, projectId),
        filter.kind ? eq(assets.kind, filter.kind) : undefined,
      ),
      orderBy: [desc(assets.capturedAt), desc(assets.createdAt)],
    });
  } catch (error) {
    // Before the migration has run there is no table yet: an empty library, not a crash.
    if (/no such table/i.test(String(error))) return [];
    throw error;
  }
  const tag = filter.tag?.toLowerCase(),
    feature = filter.feature?.toLowerCase();
  return rows
    .map(row)
    .filter(
      (a) =>
        (!tag || a.tags.includes(tag)) &&
        (!feature || (a.feature ?? "").toLowerCase() === feature),
    );
}

export async function addAsset(
  projectId: string,
  file: { name: string; data: Buffer },
  details: {
    kind?: string;
    feature?: string | null;
    tags?: string | string[] | null;
    capturedAt?: number | null;
    note?: string | null;
  } = {},
): Promise<Asset> {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) throw new Error("Invalid project");
  const ext = extname(file.name).toLowerCase();
  if (!TYPES[ext])
    throw new Error("Only PNG, JPEG, WebP, GIF, MP4 or MOV files");
  if (file.data.length > 60 * 1024 * 1024)
    throw new Error("File too large (max 60 MB)");
  const kind = ASSET_KINDS.includes(details.kind as AssetKind)
    ? (details.kind as AssetKind)
    : isClip(file.name)
      ? "clip"
      : "screenshot";
  const name = `${uuidv4()}${ext}`;
  const dir = join(process.cwd(), "public", "uploads", projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), file.data);
  const [created] = await db
    .insert(assets)
    .values({
      projectId,
      path: `/uploads/${projectId}/${name}`,
      kind,
      feature: details.feature?.trim().slice(0, 60) || null,
      tags: JSON.stringify(parseTags(details.tags)),
      note: details.note?.trim().slice(0, 500) || null,
      capturedAt: details.capturedAt ?? Date.now(),
    })
    .returning();
  return row(created);
}

export async function updateAsset(
  id: string,
  projectId: string,
  details: {
    kind?: string;
    feature?: string | null;
    tags?: string | string[] | null;
    capturedAt?: number | null;
    note?: string | null;
  },
): Promise<void> {
  await db
    .update(assets)
    .set({
      ...(ASSET_KINDS.includes(details.kind as AssetKind)
        ? { kind: details.kind }
        : {}),
      ...(details.feature !== undefined
        ? { feature: details.feature?.trim().slice(0, 60) || null }
        : {}),
      ...(details.tags !== undefined
        ? { tags: JSON.stringify(parseTags(details.tags)) }
        : {}),
      ...(details.capturedAt ? { capturedAt: details.capturedAt } : {}),
      ...(details.note !== undefined
        ? { note: details.note?.trim().slice(0, 500) || null }
        : {}),
    })
    .where(and(eq(assets.id, id), eq(assets.projectId, projectId)));
}

/** Takes it out of the library. The file stays on disk, so a post that used it keeps working. */
export async function removeAsset(id: string, projectId: string): Promise<void> {
  await db
    .delete(assets)
    .where(and(eq(assets.id, id), eq(assets.projectId, projectId)));
}

/** How many posts use each asset path (as a background or inside a slide). */
export async function assetUsage(
  projectId: string,
  paths: string[],
): Promise<Map<string, number>> {
  const posts = await db.query.generatedPosts.findMany({
    where: eq(generatedPosts.projectId, projectId),
    columns: { backgroundImageUrl: true, carouselSlides: true, metadata: true },
  });
  const usage = new Map<string, number>();
  for (const path of paths) {
    const count = posts.filter(
      (p) =>
        p.backgroundImageUrl?.includes(path) ||
        p.carouselSlides?.includes(path) ||
        p.metadata?.includes(path),
    ).length;
    if (count) usage.set(path, count);
  }
  return usage;
}
