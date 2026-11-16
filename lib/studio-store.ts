// Variants and snippets. A missing table (before migrate) leaves the queue working.
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { postVariants, snippets } from "@/drizzle/schema";
import type { ChannelDraft } from "./studio-check";

export type VariantRow = {
  id: string;
  channel: string;
  caption: string | null;
  hashtags: string | null;
  firstComment: string | null;
  altText: string | null;
};

export type SnippetRow = {
  id: string;
  label: string;
  body: string;
  kind: string;
};

export type VariantWrite = {
  channel: string;
  caption: string | null;
  hashtags: string | null;
  firstComment: string;
  altText: string | null;
};

function missing(error: unknown): boolean {
  return /no such table/i.test(String(error));
}

export async function variantsFor(postId: string): Promise<VariantRow[]> {
  try {
    const rows = await db.query.postVariants.findMany({
      where: eq(postVariants.postId, postId),
    });
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      caption: row.caption,
      hashtags: row.hashtags,
      firstComment: row.firstComment,
      altText: row.altText,
    }));
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
}

/** The channel's own caption, or null when it should inherit the main post. */
export async function variantDraft(postId: string, channel: string): Promise<ChannelDraft | null> {
  try {
    const row = await db.query.postVariants.findFirst({
      where: and(eq(postVariants.postId, postId), eq(postVariants.channel, channel)),
    });
    if (!row) return null;
    return { caption: row.caption, hashtags: row.hashtags, firstComment: row.firstComment };
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

export async function saveVariants(postId: string, rows: VariantWrite[]) {
  const keep = rows.filter(
    (row) => row.caption != null || row.hashtags != null || row.firstComment.trim() || row.altText,
  );
  await db.delete(postVariants).where(eq(postVariants.postId, postId));
  if (!keep.length) return;
  await db.insert(postVariants).values(
    keep.map((row) => ({
      postId,
      channel: row.channel,
      caption: row.caption,
      hashtags: row.hashtags,
      firstComment: row.firstComment.trim() || null,
      altText: row.altText,
    })),
  );
}

export async function snippetsFor(projectId: string): Promise<SnippetRow[]> {
  try {
    const rows = await db.query.snippets.findMany({
      where: eq(snippets.projectId, projectId),
      orderBy: [asc(snippets.label)],
    });
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      body: row.body,
      kind: row.kind ?? "line",
    }));
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
}

export async function addSnippet(projectId: string, label: string, body: string, kind: "line" | "hashtags") {
  const name = label.trim();
  const text = body.trim();
  if (!name) throw new Error("Name the line");
  if (!text) throw new Error("Write the line");
  if (name.length > 80) throw new Error("Keep the name under 80 characters");
  if (text.length > 500) throw new Error("Keep the line under 500 characters");
  const [row] = await db
    .insert(snippets)
    .values({ projectId, label: name, body: text, kind })
    .returning();
  return { id: row.id, label: row.label, body: row.body, kind: row.kind ?? "line" };
}

export async function removeSnippet(projectId: string, id: string) {
  await db.delete(snippets).where(and(eq(snippets.id, id), eq(snippets.projectId, projectId)));
}
