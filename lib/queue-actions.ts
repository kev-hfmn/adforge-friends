// Every change the owner or Claude can make to a queued post, once. The server actions
// (app/projects/[id]/queue/actions.ts) add page refreshes on top; scripts/queue.ts
// calls these directly. Nothing in this file publishes.
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { generatedPosts, postNotes } from "@/drizzle/schema";
import { checkQueueCopy } from "./queue-copy";
import { postLabel, type QueuePost } from "./queue-view";
import { captureTaste, linkPost } from "./kb";
import { approvalTime, futureTime } from "./queue-rules";

export async function loadPost(id: string, projectId?: string): Promise<QueuePost> {
  const post = await db.query.generatedPosts.findFirst({
    where: projectId
      ? and(eq(generatedPosts.id, id), eq(generatedPosts.projectId, projectId))
      : eq(generatedPosts.id, id),
  });
  if (!post) throw new Error("Post not found in this project");
  return post;
}

export function assertEditable(post: QueuePost) {
  if (post.status === "posted" || post.igMediaId)
    throw new Error("Published posts are read-only");
}

async function assertCopy(post: QueuePost) {
  const errors = await checkQueueCopy(
    post,
    post.caption ?? "",
    post.hashtags ?? "",
  );
  if (errors.length) throw new Error(errors.join(", "));
  if (post.projectId)
    linkPost(post.projectId, post.id, [post.caption, post.hashtags].filter(Boolean).join("\n\n"));
}

/** Approve at `at`, or at the post's proposed time. Always ends with a future time. */
export async function approveAt(post: QueuePost, at?: number): Promise<number> {
  assertEditable(post);
  if ((await openRequests({ postId: post.id })).length)
    throw new Error(
      "This post has an open change request. Resolve or dismiss it first.",
    );
  await assertCopy(post);
  const time = approvalTime(post, at);
  if (!post.imagePath) throw new Error("Render this post before approving");
  await db
    .update(generatedPosts)
    .set({ status: "approved", scheduledAt: time, publishError: null })
    .where(eq(generatedPosts.id, post.id));
  return time;
}

/**
 * Set or move the time. On a post waiting for review this is the proposed time
 * (nothing goes out until it is approved). On an approved post it reschedules.
 */
export async function setTime(post: QueuePost, at: number): Promise<number> {
  assertEditable(post);
  if (post.status !== "pending" && post.status !== "approved")
    throw new Error("Only posts in review or approved posts can be given a time");
  const time = futureTime(at);
  await db
    .update(generatedPosts)
    .set({ scheduledAt: time })
    .where(eq(generatedPosts.id, post.id));
  return time;
}

/** Undo placing a review post: it goes back to having no time, and it does not go out. */
export async function clearProposedTime(post: QueuePost) {
  assertEditable(post);
  if (post.status !== "pending")
    throw new Error("Only a post in review can go back to having no time");
  await db
    .update(generatedPosts)
    .set({ scheduledAt: null })
    .where(eq(generatedPosts.id, post.id));
}

/** A blank post in review, at a rhythm slot. It does not publish. */
export async function startPostAt(
  projectId: string,
  at: number,
  label: string,
): Promise<string> {
  const time = futureTime(at);
  const title = label.trim().slice(0, 120);
  if (!title) throw new Error("Name the post");
  const id = crypto.randomUUID();
  await db.insert(generatedPosts).values({
    id,
    projectId,
    status: "pending",
    templateType: "ad",
    headline: title,
    caption: "",
    scheduledAt: time,
    source: "manual",
  });
  return id;
}

/** Back to review. Keeps the time as a proposal; a pending post never publishes. */
export async function backToReview(post: QueuePost) {
  assertEditable(post);
  await db
    .update(generatedPosts)
    .set({ status: "pending", publishError: null })
    .where(eq(generatedPosts.id, post.id));
}

export async function decline(post: QueuePost) {
  assertEditable(post);
  await db
    .update(generatedPosts)
    .set({ status: "declined", scheduledAt: null })
    .where(eq(generatedPosts.id, post.id));
  captureTaste({
    projectId: post.projectId,
    title: `Declined: ${postLabel(post)}`,
    what: postLabel(post),
    verdict: "declined",
    reason: "",
    before: post.caption ?? "",
  });
}

// ─── Notes ("Request changes") ───────────────────────────────────────────────

export type PostNote = typeof postNotes.$inferSelect;

/** Open notes, oldest first. Empty (never a crash) if the notes table is not there yet. */
export async function openNotes(
  filter: { postId?: string; projectId?: string } = {},
): Promise<PostNote[]> {
  try {
    return await db.query.postNotes.findMany({
      where: and(
        isNull(postNotes.resolvedAt),
        filter.postId ? eq(postNotes.postId, filter.postId) : undefined,
        filter.projectId ? eq(postNotes.projectId, filter.projectId) : undefined,
      ),
      orderBy: [asc(postNotes.createdAt)],
    });
  } catch (error) {
    if (/no such table/i.test(String(error))) return [];
    throw error;
  }
}

/** Open notes from the owner: the change requests Claude still has to act on. */
export async function openRequests(
  filter: { postId?: string; projectId?: string } = {},
): Promise<PostNote[]> {
  return (await openNotes(filter)).filter((n) => n.author !== "claude");
}

export async function notesFor(postId: string): Promise<PostNote[]> {
  try {
    return await db.query.postNotes.findMany({
      where: eq(postNotes.postId, postId),
      orderBy: [asc(postNotes.createdAt)],
    });
  } catch (error) {
    if (/no such table/i.test(String(error))) return [];
    throw error;
  }
}

/**
 * The owner asks for a change. The note is stored and the post goes back to `pending`
 * (keeping its time as a proposal), so it cannot go out until it is approved again.
 */
export async function requestChanges(
  post: QueuePost,
  body: string,
  slide?: number | null,
  author: "owner" | "claude" = "owner",
  extra?: { parentId?: string | null; suggestion?: string | null },
): Promise<PostNote> {
  assertEditable(post);
  const text = body.trim();
  if (!text) throw new Error("Write what should change");
  if (text.length > 2000) throw new Error("Keep the note under 2,000 characters");
  if (slide != null && (!Number.isInteger(slide) || slide < 1))
    throw new Error("Slide numbers start at 1");
  const [note] = await db
    .insert(postNotes)
    .values({
      postId: post.id,
      projectId: post.projectId,
      author,
      body: text,
      slide: slide ?? null,
      parentId: extra?.parentId ?? null,
      suggestion: extra?.suggestion ?? null,
    })
    .returning();
  if (author === "owner" && post.status !== "pending")
    await db
      .update(generatedPosts)
      .set({ status: "pending", publishError: null })
      .where(eq(generatedPosts.id, post.id));
  if (author === "owner")
    captureTaste({
      projectId: post.projectId,
      title: `Change requested: ${postLabel(post)}`,
      what: postLabel(post),
      verdict: "change requested",
      reason: text,
      before: post.caption ?? "",
    });
  return note;
}

/** Close a note, with what was changed (Claude) or nothing (the owner dismissing it). */
export async function resolveNote(noteId: string, reply?: string): Promise<PostNote> {
  const note = await db.query.postNotes.findFirst({ where: eq(postNotes.id, noteId) });
  if (!note) throw new Error("Note not found");
  if (note.resolvedAt) throw new Error("This note is already resolved");
  const [updated] = await db
    .update(postNotes)
    .set({ resolvedAt: Date.now(), reply: reply?.trim() || null })
    .where(eq(postNotes.id, noteId))
    .returning();
  captureTaste({
    projectId: note.projectId,
    title: "Resolved a note",
    what: note.body,
    verdict: "resolved",
    reason: reply?.trim() || "",
    before: note.body,
    after: reply?.trim() || "",
  });
  return updated;
}

/** A model suggestion. It does not change the caption until someone accepts it. */
export async function addSuggestion(
  post: QueuePost,
  body: string,
  suggestion: string,
): Promise<PostNote> {
  assertEditable(post);
  const text = body.trim();
  if (!text) throw new Error("Write what the suggestion is");
  const [note] = await db
    .insert(postNotes)
    .values({
      postId: post.id,
      projectId: post.projectId,
      author: "claude",
      body: text,
      suggestion,
    })
    .returning();
  return note;
}
