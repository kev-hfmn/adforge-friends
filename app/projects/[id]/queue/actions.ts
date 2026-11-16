"use server";

import { db } from "@/lib/db";
import {
  generatedPosts,
  generationLogs,
  projects,
  socialChannels,
} from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { renderPost, renderCarousel } from "@/lib/render";
import { publishPostToInstagram } from "@/lib/publish";
import { retryPublication } from "@/lib/crosspost";
import { checkQueueCopy, type CopyDraft } from "@/lib/queue-copy";
import { connectionState, facebookConnected, metadata, targetChannel, type QueuePost } from "@/lib/queue-view";
import { refreshPublishedInsights } from "@/lib/queue-tracking";
import type { CarouselSlide } from "@/lib/anthropic";
import {
  approveAt,
  backToReview,
  clearProposedTime,
  decline,
  notesFor,
  addSuggestion,
  requestChanges,
  resolveNote,
  setTime,
  startPostAt,
} from "@/lib/queue-actions";
import { postLabel } from "@/lib/queue-view";
import { captureTaste, linkPost } from "@/lib/kb";
import { copyMode } from "@/lib/project-rules";
import { addSnippet, removeSnippet, saveVariants, type VariantWrite } from "@/lib/studio-store";
import { applySuggestion, parseSuggestion } from "@/lib/studio-suggestion";
import type { StudioChannel } from "@/lib/studio-check";

// The word the publish buttons must send. A stray or old caller without it is refused,
// so nothing publishes without the confirmation step in the UI.
const PUBLISH_CONFIRMATION = "publish-now";

async function getPost(id: string, projectId: string) {
  const post = await db.query.generatedPosts.findFirst({
    where: and(
      eq(generatedPosts.id, id),
      eq(generatedPosts.projectId, projectId),
    ),
  });
  if (!post) throw new Error("Post not found in this project");
  return post;
}
function refresh(projectId: string) {
  // Home, Plan and Posts all show the queue.
  revalidatePath(`/projects/${projectId}`, "layout");
}
function editable(post: Awaited<ReturnType<typeof getPost>>) {
  if (post.status === "posted" || post.igMediaId)
    throw new Error("Published posts are read-only");
}
export async function validateQueueCopy(
  id: string,
  projectId: string,
  caption: string,
  hashtags: string,
) {
  return checkQueueCopy(await getPost(id, projectId), caption, hashtags);
}
export async function approvePost(
  id: string,
  projectId: string,
  scheduledAt?: number,
) {
  let post = await getPost(id, projectId);
  editable(post);
  if (!post.imagePath) post = await rerenderPost(id, projectId);
  // Refuses a missing or passed time: see lib/queue-rules.ts.
  await approveAt(post, scheduledAt);
  refresh(projectId);
}
/** Set the proposed time (post in review) or move the scheduled time (approved post). */
export async function schedulePost(
  id: string,
  projectId: string,
  scheduledAt: number,
) {
  await setTime(await getPost(id, projectId), scheduledAt);
  refresh(projectId);
  return getPost(id, projectId);
}
/** Undo: a review post goes back to the tray. An approved post cannot lose its time this way. */
export async function clearPlanTime(id: string, projectId: string) {
  await clearProposedTime(await getPost(id, projectId));
  refresh(projectId);
}
/** A blank post in review at a chosen time. Scheduling only, never publishing. */
export async function startPlanPost(projectId: string, at: number, label: string) {
  const id = await startPostAt(projectId, at, label);
  refresh(projectId);
  return id;
}
export async function declinePost(id: string, projectId: string) {
  await decline(await getPost(id, projectId));
  refresh(projectId);
}
export async function deletePost(id: string, projectId: string) {
  await getPost(id, projectId);
  db.transaction((tx) => {
    tx.update(generationLogs)
      .set({ postId: null })
      .where(eq(generationLogs.postId, id))
      .run();
    tx.delete(generatedPosts).where(eq(generatedPosts.id, id)).run();
  });
  refresh(projectId);
}
export async function moveToQueue(id: string, projectId: string) {
  await backToReview(await getPost(id, projectId));
  refresh(projectId);
}
export async function undoDecision(
  id: string,
  projectId: string,
  prior: string,
  scheduledAt: number | null,
  expected: string,
) {
  const post = await getPost(id, projectId);
  editable(post);
  if (
    !["pending", "draft", "declined", "approved", "failed"].includes(prior) ||
    !["approved", "declined"].includes(expected) ||
    post.status !== expected
  )
    throw new Error("Post has changed. Reopen it before deciding again.");
  await db
    .update(generatedPosts)
    .set({ status: prior, scheduledAt })
    .where(eq(generatedPosts.id, id));
  refresh(projectId);
}
export type StudioSave = {
  caption: string;
  hashtags: string;
  firstComment?: string;
  altTexts?: string[];
  location?: string;
  storyGate?: string[];
  warningOverrides?: string[];
  variants?: { channel: StudioChannel; caption: string | null; hashtags: string | null; firstComment: string }[];
};

export async function saveQueuePost(id: string, projectId: string, data: StudioSave) {
  const post = await getPost(id, projectId);
  editable(post);
  const draft: CopyDraft = {
    firstComment: data.firstComment,
    altTexts: data.altTexts,
    variants: Object.fromEntries((data.variants ?? []).map((row) => [row.channel, row])),
  };
  const errors = await checkQueueCopy(post, data.caption, data.hashtags, draft);
  if (errors.length) throw new Error(errors.join(", "));
  const captionChanged = (post.caption ?? "") !== data.caption || (post.hashtags ?? "") !== data.hashtags;
  await db
    .update(generatedPosts)
    .set({ caption: data.caption, hashtags: data.hashtags })
    .where(eq(generatedPosts.id, id));
  const current = await getPost(id, projectId);
  const meta = metadata(current);
  const altJoined = (data.altTexts ?? []).map((line) => line.trim()).filter(Boolean).join("\n");
  await db
    .update(generatedPosts)
    .set({
      metadata: JSON.stringify({
        ...meta,
        queueEditedAt: Date.now(),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.storyGate !== undefined ? { storyGate: data.storyGate } : {}),
        ...(data.warningOverrides !== undefined ? { warningOverrides: data.warningOverrides } : {}),
        ...(data.altTexts !== undefined ? { altText: altJoined } : {}),
      }),
      status: "pending",
    })
    .where(eq(generatedPosts.id, id));
  const rows: VariantWrite[] = [
    {
      channel: "instagram",
      caption: null,
      hashtags: null,
      firstComment: data.firstComment ?? "",
      altText: data.altTexts ? JSON.stringify(data.altTexts) : null,
    },
    ...(data.variants ?? []).map((row) => ({
      channel: row.channel,
      caption: row.caption,
      hashtags: row.hashtags,
      firstComment: row.firstComment,
      altText: null,
    })),
  ];
  await saveVariants(id, rows);
  if (captionChanged)
    captureTaste({
      projectId,
      title: `Caption edited: ${postLabel(post)}`,
      what: postLabel(post),
      verdict: "caption edited",
      reason: "",
      before: post.caption ?? "",
      after: data.caption,
    });
  const extra = [
    data.firstComment,
    ...(data.variants ?? []).flatMap((row) => [row.caption, row.hashtags, row.firstComment]),
  ];
  linkPost(projectId, id, [data.caption, data.hashtags, ...extra].filter(Boolean).join("\n\n"));
  refresh(projectId);
  return getPost(id, projectId);
}
export async function rerenderPost(id: string, projectId: string) {
  const post = await getPost(id, projectId);
  editable(post);
  if (post.templateType === "carousel") {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    let slides: CarouselSlide[];
    try {
      slides = JSON.parse(post.carouselSlides ?? "[]");
    } catch {
      throw new Error("Invalid carousel slides");
    }
    if (!slides.length) throw new Error("No carousel slides to render");
    await renderCarousel(
      id,
      slides,
      project?.brandColor ?? "#40b0c8",
      project?.logoPath ?? undefined,
      post.palette ?? undefined,
    );
  } else await renderPost(id);
  refresh(projectId);
  return getPost(id, projectId);
}
/** Whether the channel this post publishes to (Instagram, or Facebook for a Facebook-only post) is connected. */
async function targetConnected(post: QueuePost, projectId: string): Promise<boolean> {
  const platform = targetChannel(post);
  const channel = await db.query.socialChannels.findFirst({
    where: and(
      eq(socialChannels.projectId, projectId),
      eq(socialChannels.platform, platform),
    ),
  });
  return platform === "facebook" ? facebookConnected(channel) : connectionState(channel).active;
}
export async function publishToInstagram(
  id: string,
  projectId: string,
  confirmation: string,
): Promise<{ success: boolean; error?: string }> {
  if (confirmation !== PUBLISH_CONFIRMATION)
    return { success: false, error: "Publishing now needs a confirmation" };
  const post = await getPost(id, projectId);
  if (post.status !== "approved")
    return { success: false, error: "Approve this post before publishing" };
  if (!(await targetConnected(post, projectId)))
    return {
      success: false,
      error: `Publishing is paused. Reconnect ${targetChannel(post) === "facebook" ? "Facebook" : "Instagram"}.`,
    };
  try {
    await publishPostToInstagram(id, projectId);
    refresh(projectId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    if (message === "This post is already publishing")
      return { success: false, error: message };
    await db
      .update(generatedPosts)
      .set({ status: "failed", publishError: message })
      .where(
        and(eq(generatedPosts.id, id), eq(generatedPosts.status, "approved")),
      );
    refresh(projectId);
    return { success: false, error: message };
  }
}
export async function retryPublish(
  id: string,
  projectId: string,
  confirmation: string,
) {
  if (confirmation !== PUBLISH_CONFIRMATION)
    throw new Error("Publishing now needs a confirmation");
  const post = await getPost(id, projectId);
  if (post.status !== "failed")
    throw new Error("Only failed posts can be retried");
  if (!(await targetConnected(post, projectId)))
    throw new Error(`Reconnect ${targetChannel(post) === "facebook" ? "Facebook" : "Instagram"} before retrying`);
  const errors = await checkQueueCopy(
    post,
    post.caption ?? "",
    post.hashtags ?? "",
  );
  if (errors.length) throw new Error(errors.join(", "));
  // A confirmed retry publishes right away, so the old (passed) time may stay.
  await db
    .update(generatedPosts)
    .set({ status: "approved", publishError: null })
    .where(and(eq(generatedPosts.id, id), eq(generatedPosts.status, "failed")));
  return publishToInstagram(id, projectId, confirmation);
}
export async function refreshQueueStats(projectId: string) {
  const result = await refreshPublishedInsights(projectId, true);
  refresh(projectId);
  return result;
}

/** "Request changes": store the owner's note and hand the post to Claude's lane. */
export async function requestPostChanges(
  id: string,
  projectId: string,
  body: string,
  slide?: number | null,
) {
  await requestChanges(await getPost(id, projectId), body, slide);
  refresh(projectId);
  return { post: await getPost(id, projectId), notes: await notesFor(id) };
}
/** The owner closes a note themself ("never mind"), or marks Claude's note as read. */
export async function dismissNote(noteId: string, id: string, projectId: string) {
  await getPost(id, projectId);
  const notes = await notesFor(id);
  if (!notes.some((n) => n.id === noteId)) throw new Error("Note not found");
  await resolveNote(noteId);
  refresh(projectId);
  return notesFor(id);
}
/**
 * "Approve week": approve each listed post at its own proposed time. Posts with no
 * time, a passed time, an open change request or a copy problem are refused and
 * reported; the rest still go through.
 */
export async function approveWeek(projectId: string, ids: string[]) {
  const approved: string[] = [],
    refused: { id: string; label: string; reason: string }[] = [];
  for (const id of ids.slice(0, 50)) {
    const post = await getPost(id, projectId);
    try {
      if (post.status !== "pending") throw new Error("No longer waiting for review");
      await approveAt(post);
      approved.push(id);
    } catch (error) {
      refused.push({
        id,
        label: postLabel(post),
        reason: error instanceof Error ? error.message : "Could not approve",
      });
    }
  }
  refresh(projectId);
  return { approved: approved.length, refused };
}

export async function retryCrosspost(publicationId: string, projectId: string) {
  try {
    await retryPublication(publicationId);
    revalidatePath(`/projects/${projectId}`, "layout");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Retry failed" };
  }
}

export async function acceptCaptionSuggestion(noteId: string, id: string, projectId: string) {
  const post = await getPost(id, projectId);
  editable(post);
  const notes = await notesFor(id);
  const note = notes.find((item) => item.id === noteId);
  if (!note) throw new Error("Note not found");
  const suggestion = parseSuggestion(note.suggestion);
  if (!suggestion) throw new Error("This note has no suggestion");
  const current =
    suggestion.field === "caption"
      ? (post.caption ?? "")
      : suggestion.field === "hashtags"
        ? (post.hashtags ?? "")
        : "";
  const next = applySuggestion(current, suggestion);
  const caption = suggestion.field === "caption" ? next : (post.caption ?? "");
  const hashtags = suggestion.field === "hashtags" ? next : (post.hashtags ?? "");
  const errors = await checkQueueCopy(post, caption, hashtags);
  if (errors.length) throw new Error(errors.join(", "));
  if (suggestion.field === "firstComment") {
    const { variantsFor } = await import("@/lib/studio-store");
    const rows = await variantsFor(id);
    const instagram = rows.find((row) => row.channel === "instagram");
    await saveVariants(id, [
      ...rows
        .filter((row) => row.channel !== "instagram")
        .map((row) => ({
          channel: row.channel,
          caption: row.caption,
          hashtags: row.hashtags,
          firstComment: row.firstComment ?? "",
          altText: row.altText,
        })),
      {
        channel: "instagram",
        caption: instagram?.caption ?? null,
        hashtags: instagram?.hashtags ?? null,
        firstComment: applySuggestion(instagram?.firstComment ?? "", suggestion),
        altText: instagram?.altText ?? null,
      },
    ]);
  } else {
    await db
      .update(generatedPosts)
      .set({ caption, hashtags, status: "pending" })
      .where(eq(generatedPosts.id, id));
  }
  await resolveNote(noteId, "Accepted the suggestion");
  captureTaste({
    projectId,
    title: `Accepted a suggestion: ${postLabel(post)}`,
    what: postLabel(post),
    verdict: "suggestion accepted",
    reason: note.body,
    before: current,
    after: next,
  });
  linkPost(projectId, id, [caption, hashtags].filter(Boolean).join("\n\n"));
  refresh(projectId);
  return { post: await getPost(id, projectId), notes: await notesFor(id) };
}

export async function askForRewrite(id: string, projectId: string, instruction: string) {
  const post = await getPost(id, projectId);
  editable(post);
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const mode = copyMode(project ?? { id: projectId });
  const ask = instruction.trim() || "Make it shorter and clearer. Keep every fact.";
  if (mode === "claude_session") {
    await requestChanges(post, `Please rewrite this caption. ${ask}`);
    refresh(projectId);
    return { kind: "note" as const, post: await getPost(id, projectId), notes: await notesFor(id) };
  }
  const { suggestCaption } = await import("@/lib/studio-rewrite");
  const text = await suggestCaption(projectId, post.caption ?? "", ask);
  await addSuggestion(
    post,
    "Suggested rewrite. Accept it to replace the caption, or dismiss it.",
    JSON.stringify({ field: "caption", from: 0, to: (post.caption ?? "").length, text }),
  );
  refresh(projectId);
  return { kind: "suggestion" as const, post: await getPost(id, projectId), notes: await notesFor(id) };
}

export async function createSnippet(projectId: string, label: string, body: string, kind: "line" | "hashtags") {
  const row = await addSnippet(projectId, label, body, kind);
  refresh(projectId);
  return row;
}

export async function deleteSnippet(projectId: string, snippetId: string) {
  await removeSnippet(projectId, snippetId);
  refresh(projectId);
}
