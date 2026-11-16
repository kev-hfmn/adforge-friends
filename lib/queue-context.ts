// Everything a project page (Home, Week, Posts) needs to know about the queue, loaded once
// and described the same way everywhere.
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  autopilotConfig,
  generatedPosts,
  projects,
  socialChannels,
} from "@/drizzle/schema";
import { connectionState } from "./queue-view";
import { localInput, nextDailyRun, projectSlots } from "./queue-schedule";
import { timing } from "./queue-rules";
import { openNotes } from "./queue-actions";

type Autopilot = typeof autopilotConfig.$inferSelect;

/** What the automation will really do next, in plain words (not the state of a switch). */
export async function automationLine(
  projectId: string,
  autopilot: Autopilot | undefined,
  now: number,
): Promise<string> {
  if (!autopilot?.enabled) return "Nothing is drafted automatically";
  const hour = localInput(nextDailyRun(autopilot.cronTime, now)).slice(11);
  return autopilot.autoPostAfterApproval
    ? `New posts are drafted at ${hour} and publish themselves`
    : `New posts are drafted at ${hour} and wait for your OK`;
}

export async function loadQueueContext(projectId: string, now: number) {
  const [posts, project, channel, autopilot, open] = await Promise.all([
    db.query.generatedPosts.findMany({
      where: eq(generatedPosts.projectId, projectId),
      orderBy: [desc(generatedPosts.createdAt)],
    }),
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
    db.query.socialChannels.findFirst({
      where: and(
        eq(socialChannels.projectId, projectId),
        eq(socialChannels.platform, "instagram"),
      ),
    }),
    db.query.autopilotConfig.findFirst({
      where: eq(autopilotConfig.projectId, projectId),
    }),
    openNotes({ projectId }),
  ]);
  if (!project) return null;
  const withClaude = new Set(
    open.filter((n) => n.author !== "claude").map((n) => n.postId),
  );
  return {
    project,
    posts,
    channel,
    autopilot,
    /** The project's usual posting week (may be empty). */
    slots: projectSlots(project),
    connection: connectionState(channel, now),
    username:
      channel?.igUsername ??
      project.name.toLowerCase().replace(/\s+/g, ""),
    brandColor: project.brandColor ?? "#40b0c8",
    openNotes: open,
    /** Posts with an open change request from the owner. */
    withClaude,
    /** Claude's open notes to the owner. */
    forOwner: open.filter((n) => n.author === "claude"),
    noteByPost: new Map(open.map((n) => [n.postId, n])),
    noTime: posts.filter((p) => timing(p, now) === "no-time"),
    nextOut: posts
      .filter((p) => timing(p, now) === "scheduled")
      .sort((a, b) => a.scheduledAt! - b.scheduledAt!),
    automation: await automationLine(projectId, autopilot, now),
  };
}
export type QueueContext = NonNullable<Awaited<ReturnType<typeof loadQueueContext>>>;

/**
 * For the project switcher and the start page: how many things wait for the owner in
 * each project (posts to review, approved posts with no time, failed posts).
 */
export async function projectNeeds(now: number): Promise<Map<string, number>> {
  const [rows, open] = await Promise.all([
    db.query.generatedPosts.findMany({
      columns: { id: true, projectId: true, status: true, scheduledAt: true },
    }),
    openNotes(),
  ]);
  const withClaude = new Set(
    open.filter((n) => n.author !== "claude").map((n) => n.postId),
  );
  const needs = new Map<string, number>();
  for (const post of rows) {
    if (!post.projectId) continue;
    const state = timing(post, now);
    const waits =
      state === "no-time" ||
      state === "failed" ||
      (post.status === "pending" && !withClaude.has(post.id));
    if (waits) needs.set(post.projectId, (needs.get(post.projectId) ?? 0) + 1);
  }
  return needs;
}
