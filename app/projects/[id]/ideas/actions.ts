"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sqlite } from "@/lib/db";
import { isIdeaStatus } from "@/lib/ideas";
import {
  createIdea,
  ideaFromTakeaway,
  moveIdea,
  proposeDraftSlot,
  readIdea,
  turnIdeaIntoPost,
} from "@/lib/ideas-store";
import { loadQueueContext } from "@/lib/queue-context";

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function createIdeaAction(projectId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const pillar = String(formData.get("pillar") ?? "").trim();
  const format = String(formData.get("format") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const formats = ["", "reel", "carousel", "photo"];
  if (!formats.includes(format)) throw new Error("Unknown format");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Use a full link, starting with https");
  createIdea(sqlite, {
    projectId,
    title,
    body,
    pillar: pillar || null,
    format: format || null,
    status: "inbox",
    createdBy: "owner",
    links: { urls: url ? [url] : [], assetIds: [], sourcePostId: null },
  });
  refresh(projectId);
  redirect(`/projects/${projectId}/ideas`);
}

export async function moveIdeaAction(projectId: string, ideaId: string, status: string) {
  if (!isIdeaStatus(status)) throw new Error("Unknown column");
  if (!moveIdea(sqlite, projectId, ideaId, status)) throw new Error("That idea is not in this project");
  refresh(projectId);
}

export async function turnIdeaIntoPostAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const ideaId = String(formData.get("ideaId") ?? "");
  const now = Date.now();
  const context = await loadQueueContext(projectId, now);
  if (!context) throw new Error("Project not found");
  const result = turnIdeaIntoPost(sqlite, projectId, ideaId, context.posts, now, context.slots);
  refresh(projectId);
  redirect(`/projects/${projectId}/ideas?post=${result.postId}`);
}

/** Offers the next open slot again and puts the draft in review. Does not approve. */
export async function proposeOfferedSlot(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const ideaId = String(formData.get("ideaId") ?? "");
  const now = Date.now();
  const context = await loadQueueContext(projectId, now);
  if (!context) throw new Error("Project not found");
  const idea = readIdea(sqlite, projectId, ideaId);
  if (!idea?.postId) throw new Error("Turn this idea into a draft first");
  const result = turnIdeaIntoPost(sqlite, projectId, ideaId, context.posts, now, context.slots);
  proposeDraftSlot(sqlite, projectId, result.postId, result.offeredAt, now);
  refresh(projectId);
  redirect(`/projects/${projectId}/ideas?post=${result.postId}`);
}

/** The Results button. Reads the stored post. Does not call a model. */
export async function createIdeaFromTakeaway(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const mode = formData.get("mode") === "again" ? "again" : "reel";
  ideaFromTakeaway(sqlite, projectId, postId, mode);
  refresh(projectId);
  redirect(`/projects/${projectId}/ideas`);
}
