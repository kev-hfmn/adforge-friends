// Write side of the agent interface. Calls the existing queue, idea, and hub rules.
// Nothing here sends a post.
import { and, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { generatedPosts, postNotes } from "@/drizzle/schema";
import { updateAsset, listAssets } from "@/lib/assets";
import { recordAudit } from "./audit";
import { captionSaveDecision, requireOwnerSaid } from "./copy-rule";
import { actorFrom, readInput } from "./parse";
import { createIdea, proposeDraftSlot, readIdea } from "@/lib/ideas-store";
import { isIdeaStatus } from "@/lib/ideas";
import { createEntry, readEntry, setEntryStatus, updateEntry } from "@/lib/kb-store";
import { isKbType } from "@/lib/kb-types";
import {
  addSuggestion,
  approveAt,
  assertEditable,
  loadPost,
  requestChanges,
  resolveNote,
  setTime,
} from "@/lib/queue-actions";
import { reviewQueueCopy } from "@/lib/queue-copy";
import { localTimestamp, QUEUE_TIME_ZONE, formatDayTime } from "@/lib/queue-schedule";
import { mondayOf, shiftDay } from "@/lib/plan";
import { postLabel } from "@/lib/queue-view";
import { blocksOf, type StudioChannel, type StudioIssue } from "@/lib/studio-check";
import { saveVariants, variantsFor } from "@/lib/studio-store";
import { writeWeekReport } from "./report";

function clip(value: string, max = 160): string {
  return value.trim().slice(0, max);
}

function issuesOf(error: unknown): StudioIssue[] {
  return [
    {
      level: "block",
      code: "check",
      message: error instanceof Error ? error.message : "Check failed",
    },
  ];
}

async function checked(post: Awaited<ReturnType<typeof loadPost>>, caption: string, hashtags: string, draft?: Parameters<typeof reviewQueueCopy>[3]) {
  try {
    return await reviewQueueCopy(post, caption, hashtags, draft);
  } catch (error) {
    return issuesOf(error);
  }
}

function refuseBlocked(issues: StudioIssue[]): never {
  const blocks = blocksOf(issues);
  const detail = blocks.map((issue) => issue.message).join(" ");
  throw new Error(
    `${detail} A blocked caption is not saved as approved copy. Save it as a draft if you want the text kept.`,
  );
}

export async function ideaCreate(input: unknown) {
  const data = readInput<{
    projectId: string;
    title: string;
    body?: string;
    pillar?: string;
    format?: string;
    tags?: string[];
    status?: string;
    dueWeek?: string;
  }>("idea_create", input);
  const actor = actorFrom(input);
  if (data.status && !isIdeaStatus(data.status)) throw new Error("Unknown idea status");
  const id = createIdea(sqlite, {
    projectId: data.projectId,
    title: data.title,
    body: data.body,
    pillar: data.pillar,
    format: data.format,
    tags: data.tags,
    status: data.status && isIdeaStatus(data.status) ? data.status : "inbox",
    createdBy: actor === "claude" ? "claude" : "owner",
    dueWeek: data.dueWeek,
  });
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "idea_create",
    target: `idea:${id}`,
    afterSummary: clip(data.title),
  });
  return { id };
}

export async function ideaUpdate(input: unknown) {
  const data = readInput<{
    projectId: string;
    ideaId: string;
    title?: string;
    body?: string;
    pillar?: string | null;
    format?: string | null;
    tags?: string[];
    status?: string;
    dueWeek?: string | null;
  }>("idea_update", input);
  const actor = actorFrom(input);
  const idea = readIdea(sqlite, data.projectId, data.ideaId);
  if (!idea) throw new Error("That idea is not in this project");
  if (data.status !== undefined && !isIdeaStatus(data.status)) throw new Error("Unknown idea status");
  const title = data.title !== undefined ? clip(data.title) : idea.title;
  if (!title) throw new Error("Name the idea");
  sqlite
    .prepare(
      `UPDATE ideas
       SET title = ?, body = ?, pillar = ?, format = ?, tags = ?, status = ?, due_week = ?, updated_at = ?
       WHERE id = ? AND project_id = ?`,
    )
    .run(
      title,
      data.body !== undefined ? data.body.trim() : idea.body,
      data.pillar !== undefined ? data.pillar?.trim() || null : idea.pillar,
      data.format !== undefined ? data.format?.trim() || null : idea.format,
      JSON.stringify(data.tags ?? idea.tags),
      data.status ?? idea.status,
      data.dueWeek !== undefined ? data.dueWeek : idea.dueWeek,
      Date.now(),
      data.ideaId,
      data.projectId,
    );
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "idea_update",
    target: `idea:${data.ideaId}`,
    beforeSummary: clip(idea.title),
    afterSummary: title,
  });
  return { id: data.ideaId };
}

export async function postCreateDraft(input: unknown) {
  const data = readInput<{
    projectId: string;
    spec: {
      topic?: string;
      label?: string;
      facts?: string;
      caption?: string | string[];
      hashtags?: string;
      alt?: string;
      channel?: "instagram" | "facebook";
      templateType?: "ad" | "reel" | "carousel";
      slides?: { text: string }[];
    };
  }>("post_create_draft", input);
  const actor = actorFrom(input);
  const exists = sqlite.prepare(`SELECT id FROM projects WHERE id = ?`).get(data.projectId);
  if (!exists) throw new Error("Project not found");
  const spec = data.spec;
  const caption = Array.isArray(spec.caption) ? spec.caption.join("\n\n") : (spec.caption ?? "");
  const headline = clip(spec.label || spec.topic || "Draft", 120);
  const slides = (spec.slides ?? []).slice(0, 20);
  const templateType = spec.templateType ?? (slides.length > 1 ? "carousel" : "ad");
  const id = crypto.randomUUID();
  await db.insert(generatedPosts).values({
    id,
    projectId: data.projectId,
    status: "draft",
    templateType,
    headline,
    caption,
    hashtags: spec.hashtags ?? "",
    carouselSlides: slides.length ? JSON.stringify(slides) : null,
    metadata: JSON.stringify({
      ...(spec.topic ? { topic: spec.topic } : {}),
      ...(spec.facts ? { facts: spec.facts } : {}),
      ...(spec.alt ? { altText: spec.alt } : {}),
      ...(spec.channel === "facebook" ? { channel: "facebook" } : {}),
    }),
    source: "manual",
    scheduledAt: null,
  });
  const post = await loadPost(id, data.projectId);
  const issues = await checked(post, caption, spec.hashtags ?? "");
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "post_create_draft",
    target: `post:${id}`,
    afterSummary: headline,
  });
  return { id, status: "draft", scheduledAt: null, issues };
}

export async function postUpdateCopy(input: unknown) {
  const data = readInput<{
    projectId: string;
    postId: string;
    caption: string;
    hashtags?: string;
    asDraft?: boolean;
  }>("post_update_copy", input);
  const actor = actorFrom(input);
  const post = await loadPost(data.postId, data.projectId);
  assertEditable(post);
  const hashtags = data.hashtags ?? post.hashtags ?? "";
  const issues = await checked(post, data.caption, hashtags);
  const decision = captionSaveDecision({ blocked: blocksOf(issues).length > 0, asDraft: data.asDraft === true });
  if (decision === "refuse") refuseBlocked(issues);
  const nextStatus = decision === "draft" ? "draft" : post.status === "approved" ? "pending" : post.status;
  await db
    .update(generatedPosts)
    .set({
      caption: data.caption,
      hashtags,
      status: nextStatus,
      ...(decision === "draft" ? { scheduledAt: null } : {}),
    })
    .where(eq(generatedPosts.id, post.id));
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "post_update_copy",
    target: `post:${post.id}`,
    beforeSummary: clip(post.caption ?? "", 80),
    afterSummary: decision === "draft" ? "Saved as a draft" : clip(data.caption, 80),
  });
  return { id: post.id, status: nextStatus, issues };
}

export async function postSetVariant(input: unknown) {
  const data = readInput<{
    projectId: string;
    postId: string;
    channel: StudioChannel;
    caption?: string | null;
    hashtags?: string | null;
    firstComment?: string;
    asDraft?: boolean;
  }>("post_set_variant", input);
  const actor = actorFrom(input);
  const post = await loadPost(data.postId, data.projectId);
  assertEditable(post);
  const issues = await checked(post, post.caption ?? "", post.hashtags ?? "", {
    variants: {
      [data.channel]: {
        caption: data.caption,
        hashtags: data.hashtags,
        firstComment: data.firstComment ?? "",
      },
    },
  });
  const decision = captionSaveDecision({ blocked: blocksOf(issues).length > 0, asDraft: data.asDraft === true });
  if (decision === "refuse") refuseBlocked(issues);
  const existing = await variantsFor(post.id);
  await saveVariants(post.id, [
    ...existing
      .filter((row) => row.channel !== data.channel)
      .map((row) => ({
        channel: row.channel,
        caption: row.caption,
        hashtags: row.hashtags,
        firstComment: row.firstComment ?? "",
        altText: row.altText,
      })),
    {
      channel: data.channel,
      caption: data.caption ?? null,
      hashtags: data.hashtags ?? null,
      firstComment: data.firstComment ?? "",
      altText: null,
    },
  ]);
  if (decision === "draft") {
    await db
      .update(generatedPosts)
      .set({ status: "draft", scheduledAt: null })
      .where(eq(generatedPosts.id, post.id));
  } else if (post.status === "approved") {
    await db.update(generatedPosts).set({ status: "pending" }).where(eq(generatedPosts.id, post.id));
  }
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "post_set_variant",
    target: `post:${post.id}`,
    afterSummary: data.channel,
  });
  return { id: post.id, channel: data.channel, issues };
}

export async function postProposeTime(input: unknown) {
  const data = readInput<{ projectId: string; postId: string; time: string }>("post_propose_time", input);
  const actor = actorFrom(input);
  const at = localTimestamp(data.time);
  if (!Number.isFinite(at)) {
    throw new Error(`not a ${QUEUE_TIME_ZONE} time: ${data.time} (use YYYY-MM-DDTHH:mm)`);
  }
  const post = await loadPost(data.postId, data.projectId);
  assertEditable(post);
  const time =
    post.status === "draft"
      ? proposeDraftSlot(sqlite, data.projectId, post.id, at, Date.now())
      : await setTime(post, at);
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "post_propose_time",
    target: `post:${post.id}`,
    beforeSummary: formatDayTime(post.scheduledAt),
    afterSummary: formatDayTime(time),
  });
  return { id: post.id, scheduledAt: time, status: post.status === "draft" ? "pending" : post.status };
}

export async function noteAdd(input: unknown) {
  const data = readInput<{ projectId: string; postId: string; body: string; slide?: number }>("note_add", input);
  const actor = actorFrom(input);
  const post = await loadPost(data.postId, data.projectId);
  const author: "owner" | "claude" = actor === "owner" ? "owner" : "claude";
  const note = await requestChanges(post, data.body, data.slide, author);
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "note_add",
    target: `post:${post.id}`,
    afterSummary: clip(data.body, 80),
  });
  return { id: note.id, postId: post.id };
}

export async function noteResolve(input: unknown) {
  const data = readInput<{ projectId: string; noteId: string; reply?: string }>("note_resolve", input);
  const actor = actorFrom(input);
  const note = await db.query.postNotes.findFirst({
    where: and(eq(postNotes.id, data.noteId), eq(postNotes.projectId, data.projectId)),
  });
  if (!note) throw new Error("Note not found");
  const updated = await resolveNote(note.id, data.reply);
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "note_resolve",
    target: `post:${note.postId}`,
    beforeSummary: clip(note.body, 80),
    afterSummary: clip(data.reply ?? "Resolved", 80),
  });
  return { id: updated.id, postId: note.postId };
}

export async function suggestionAdd(input: unknown) {
  const data = readInput<{
    projectId: string;
    postId: string;
    body: string;
    text: string;
    field?: "caption" | "hashtags" | "firstComment";
  }>("suggestion_add", input);
  const actor = actorFrom(input);
  const post = await loadPost(data.postId, data.projectId);
  const field = data.field ?? "caption";
  const current = field === "hashtags" ? (post.hashtags ?? "") : field === "firstComment" ? "" : (post.caption ?? "");
  const note = await addSuggestion(
    post,
    data.body,
    JSON.stringify({ field, from: 0, to: current.length, text: data.text }),
  );
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "suggestion_add",
    target: `post:${post.id}`,
    afterSummary: clip(data.body, 80),
  });
  return { id: note.id, postId: post.id };
}

export async function kbAddEntry(input: unknown) {
  const data = readInput<{
    projectId: string;
    type: string;
    title: string;
    body?: string;
    tags?: string[];
    pillar?: string | null;
  }>("kb_add_entry", input);
  const actor = actorFrom(input);
  if (!isKbType(data.type)) throw new Error("Unknown hub type");
  const id = createEntry(sqlite, data.projectId, {
    type: data.type,
    title: data.title.trim(),
    body: data.body ?? "",
    fields: {},
    tags: data.tags ?? [],
    pillar: data.pillar ?? null,
  });
  if (actor === "claude") sqlite.prepare(`UPDATE kb_entries SET source = 'claude' WHERE id = ?`).run(id);
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "kb_add_entry",
    target: `kb:${id}`,
    afterSummary: clip(data.title),
  });
  return { id };
}

export async function kbUpdateEntry(input: unknown) {
  const data = readInput<{
    projectId: string;
    entryId: string;
    title: string;
    body?: string;
    tags?: string[];
    pillar?: string | null;
  }>("kb_update_entry", input);
  const actor = actorFrom(input);
  const entry = readEntry(sqlite, data.projectId, data.entryId);
  if (!entry) throw new Error("Entry not found");
  if (entry.source.startsWith("synced:")) throw new Error("This entry is synced from a doc. Edit the doc.");
  updateEntry(
    sqlite,
    data.projectId,
    data.entryId,
    {
      title: data.title.trim(),
      body: data.body ?? entry.body,
      fields: entry.fields,
      tags: data.tags ?? entry.tags,
      pillar: data.pillar !== undefined ? data.pillar : entry.pillar,
    },
    actor,
  );
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "kb_update_entry",
    target: `kb:${data.entryId}`,
    beforeSummary: clip(entry.title),
    afterSummary: clip(data.title),
  });
  return { id: data.entryId };
}

export async function tasteConfirm(input: unknown) {
  const data = readInput<{ projectId: string; entryId: string }>("taste_confirm", input);
  const actor = actorFrom(input);
  const entry = readEntry(sqlite, data.projectId, data.entryId);
  if (!entry) throw new Error("Entry not found");
  if (entry.source.startsWith("synced:")) throw new Error("Synced entries are edited in the doc.");
  if (entry.type !== "taste") throw new Error("Only a taste draft can be confirmed.");
  setEntryStatus(sqlite, data.projectId, data.entryId, "active");
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "taste_confirm",
    target: `kb:${data.entryId}`,
    beforeSummary: entry.status,
    afterSummary: clip(entry.title),
  });
  return { id: data.entryId, status: "active" };
}

export async function reportSave(input: unknown) {
  const data = readInput<{ projectId: string; week: string; sentence?: string }>("report_save", input);
  const actor = actorFrom(input);
  const report = await writeWeekReport(data.projectId, data.week, data.sentence ?? "");
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "report_save",
    target: `project:${data.projectId}`,
    afterSummary: report.file,
  });
  return { file: report.file, weekStart: report.start };
}

export async function assetTag(input: unknown) {
  const data = readInput<{ projectId: string; assetId: string; tags: string | string[] }>("asset_tag", input);
  const actor = actorFrom(input);
  const assets = await listAssets(data.projectId);
  const asset = assets.find((item) => item.id === data.assetId);
  if (!asset) throw new Error("Asset not found in this project");
  await updateAsset(data.assetId, data.projectId, { tags: data.tags });
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "asset_tag",
    target: `asset:${data.assetId}`,
    beforeSummary: asset.tags.join(", "),
    afterSummary: Array.isArray(data.tags) ? data.tags.join(", ") : data.tags,
  });
  return { id: data.assetId };
}

export async function approveWeek(input: unknown) {
  const data = readInput<{ projectId: string; weekStart: string; ownerSaid: string }>("approve_week", input);
  const actor = actorFrom(input);
  const quote = requireOwnerSaid(data.ownerSaid);
  const weekStart = String(data.weekStart ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || mondayOf(weekStart) !== weekStart)
    throw new Error(`weekStart must be the Monday of the week the owner approved (YYYY-MM-DD), got: ${data.weekStart}`);
  const from = localTimestamp(`${weekStart}T00:00`);
  const to = localTimestamp(`${shiftDay(weekStart, 7)}T00:00`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error(`Not a ${QUEUE_TIME_ZONE} date: ${weekStart}`);
  const exists = sqlite.prepare(`SELECT id FROM projects WHERE id = ?`).get(data.projectId);
  if (!exists) throw new Error("Project not found");
  const posts = await db.query.generatedPosts.findMany({
    where: eq(generatedPosts.projectId, data.projectId),
  });
  const inReview = posts
    .filter((post) => post.status === "pending")
    .sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity));
  const inWeek = (post: (typeof inReview)[number]) =>
    post.scheduledAt != null && post.scheduledAt >= from && post.scheduledAt < to;
  // No time: listed as refused so the owner sees it. Another week: left alone.
  const waiting = inReview.filter((post) => post.scheduledAt == null || inWeek(post));
  const skipped = inReview
    .filter((post) => post.scheduledAt != null && !inWeek(post))
    .map((post) => ({ id: post.id, label: postLabel(post), time: formatDayTime(post.scheduledAt!) }));
  const approved: { id: string; label: string; time: string }[] = [];
  const refused: { id: string; label: string; reason: string }[] = [];
  for (const post of waiting) {
    try {
      const time = await approveAt(post);
      approved.push({ id: post.id, label: postLabel(post), time: formatDayTime(time) });
    } catch (error) {
      refused.push({
        id: post.id,
        label: postLabel(post),
        reason: error instanceof Error ? error.message : "Refused",
      });
    }
  }
  recordAudit({
    projectId: data.projectId,
    actor,
    action: "approve_week",
    target: `project:${data.projectId}`,
    quote,
    beforeSummary: `Week of ${weekStart}: ${waiting.length} posts in review`,
    afterSummary: approved.length
      ? `Approved ${approved.map((item) => item.label).join(", ")}`
      : "Nothing approved",
  });
  return { quoteStored: true, weekStart, approved, refused, skipped };
}
