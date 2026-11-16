// Read side of the agent interface. Nothing here writes, and nothing here sends a post.
import { and, asc, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import {
  generatedPosts,
  postPublications,
  projects,
} from "@/drizzle/schema";
import { getBrandKitFields } from "@/lib/brand-kit";
import { listIdeas } from "@/lib/ideas-store";
import { isIdeaStatus } from "@/lib/ideas";
import { contextFor, hubEntry, searchKb } from "@/lib/kb";
import { listAssets } from "@/lib/assets";
import { listPlanEvents } from "@/lib/plan-events";
import {
  assemblePlan,
  openSlots,
  parsePlanView,
  periodOf,
  type PlanView,
} from "@/lib/plan";
import { openNotes } from "@/lib/queue-actions";
import { loadQueueContext } from "@/lib/queue-context";
import { reviewQueueCopy } from "@/lib/queue-copy";
import { timing } from "@/lib/queue-rules";
import { formatDayTime, localInput } from "@/lib/queue-schedule";
import { postLabel, targetChannel, type QueuePost } from "@/lib/queue-view";
import { assembleResults } from "@/lib/results-assemble";
import { loadResultSources } from "@/lib/results-store";
import { variantsFor } from "@/lib/studio-store";
import { checkStudioCopy, studioFormat, type StudioChannel } from "@/lib/studio-check";
import { studioSources } from "@/lib/studio-sources";
import { buildWeekReport } from "./report";
import { readInput } from "./parse";

const LANES: Record<string, ReturnType<typeof timing>[]> = {
  review: ["proposed", "proposal-passed", "unplanned"],
  scheduled: ["scheduled", "due"],
  "no-time": ["no-time"],
  failed: ["failed"],
  posted: ["posted"],
};

function issueView(issues: { level: string; code: string; message: string; channel?: string }[]) {
  return issues.map((issue) => ({
    level: issue.level,
    code: issue.code,
    message: issue.message,
    channel: issue.channel ?? null,
  }));
}

async function resultsBundle(projectId: string) {
  const sources = loadResultSources(sqlite, projectId);
  if (!sources) throw new Error("Project not found");
  const kit = await getBrandKitFields(projectId);
  const now = Date.now();
  const model = assembleResults(
    sources,
    kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label })),
    now,
    {
      plan: `/projects/${projectId}/plan`,
      post: (postId) => `/projects/${projectId}/queue?post=${postId}`,
    },
  );
  return { sources, model };
}

function queueLine(post: QueuePost, now: number) {
  const at = post.status === "posted" ? post.postedAt : post.scheduledAt;
  return {
    id: post.id,
    label: postLabel(post),
    status: post.status,
    timing: timing(post, now),
    when: formatDayTime(at),
    templateType: post.templateType,
    channel: targetChannel(post),
  };
}

export async function projectsList(input: unknown = {}) {
  readInput("projects_list", input);
  const rows = await db.query.projects.findMany({
    columns: { id: true, name: true, description: true, bioLink: true, copyMode: true },
    orderBy: [asc(projects.name)],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    site: row.bioLink,
    copyMode: row.copyMode,
  }));
}

export async function planGet(input: unknown) {
  const data = readInput<{ projectId: string; start?: string; view?: PlanView }>("plan_get", input);
  const now = Date.now();
  const context = await loadQueueContext(data.projectId, now);
  if (!context) throw new Error("Project not found");
  const today = localInput(now).slice(0, 10);
  const anchor = data.start ?? today;
  const view = parsePlanView(data.view) ?? "week";
  const period = periodOf(view, anchor);
  const noteCounts = new Map<string, number>();
  for (const note of context.openNotes) noteCounts.set(note.postId, (noteCounts.get(note.postId) ?? 0) + 1);
  let publications: { postId: string; platform: string; status: string | null }[] = [];
  try {
    publications = await db.query.postPublications.findMany({
      where: eq(postPublications.projectId, data.projectId),
      columns: { postId: true, platform: true, status: true },
    });
  } catch (error) {
    if (!/no such table/i.test(String(error))) throw error;
  }
  const kit = await getBrandKitFields(data.projectId);
  const pillars = kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label }));
  const { placed, unplaced } = assemblePlan(context.posts, now, context.withClaude, publications, pillars, noteCounts);
  const slots = openSlots(period.grid, context.slots, placed, now);
  const inPeriod = placed.filter((card) => card.day != null && card.day >= period.start && card.day <= period.end);
  const events = await listPlanEvents(data.projectId, period.start, period.end);
  const cardOf = (card: (typeof placed)[number]) => ({
    id: card.id,
    label: card.label,
    caption: card.caption.slice(0, 400),
    day: card.day,
    time: card.time,
    status: card.statusKey,
    word: card.word,
    format: card.format,
    channels: card.channels,
    notes: card.notes,
    facebookOnly: card.facebookOnly,
  });
  return {
    view,
    start: period.start,
    end: period.end,
    posts: [...inPeriod, ...unplaced].map(cardOf),
    openSlots: slots.map((slot) => ({
      day: slot.day,
      time: slot.time,
      label: slot.label,
      at: slot.at,
    })),
    events: events.map((event) => ({
      date: event.date,
      title: event.title,
      kind: event.kind,
    })),
  };
}

export async function postGet(input: unknown) {
  const data = readInput<{ projectId: string; postId: string }>("post_get", input);
  const post = await db.query.generatedPosts.findFirst({
    where: and(eq(generatedPosts.id, data.postId), eq(generatedPosts.projectId, data.projectId)),
  });
  if (!post) throw new Error("Post not found in this project");
  const [variants, notes] = await Promise.all([
    variantsFor(post.id),
    openNotes({ postId: post.id, projectId: data.projectId }),
  ]);
  let checks: { level: string; code: string; message: string; channel?: string }[] = [];
  try {
    checks = await reviewQueueCopy(post, post.caption ?? "", post.hashtags ?? "");
  } catch (error) {
    checks = [
      {
        level: "block",
        code: "check",
        message: error instanceof Error ? error.message : "Check failed",
      },
    ];
  }
  return {
    id: post.id,
    label: postLabel(post),
    status: post.status,
    timing: timing(post),
    when: formatDayTime(post.status === "posted" ? post.postedAt : post.scheduledAt),
    templateType: post.templateType,
    channel: targetChannel(post),
    headline: post.headline,
    caption: post.caption,
    hashtags: post.hashtags,
    variants: variants.map((row) => ({
      channel: row.channel,
      caption: row.caption,
      hashtags: row.hashtags,
      firstComment: row.firstComment,
    })),
    openNotes: notes.map((note) => ({
      id: note.id,
      author: note.author,
      body: note.body,
      slide: note.slide,
    })),
    checks: issueView(checks),
  };
}

export async function queueList(input: unknown) {
  const data = readInput<{ projectId: string; lane?: string }>("queue_list", input);
  const now = Date.now();
  const posts = await db.query.generatedPosts.findMany({
    where: eq(generatedPosts.projectId, data.projectId),
  });
  const lane = data.lane;
  const filtered = posts
    .filter((post) => (lane ? LANES[lane]?.includes(timing(post, now)) : !["off", "posted"].includes(timing(post, now))))
    .sort((a, b) => (a.scheduledAt ?? a.postedAt ?? Infinity) - (b.scheduledAt ?? b.postedAt ?? Infinity));
  return filtered.map((post) => queueLine(post, now));
}

export async function notesListOpen(input: unknown = {}) {
  const data = readInput<{ projectId?: string; postId?: string }>("notes_list_open", input);
  const notes = await openNotes({ projectId: data.projectId, postId: data.postId });
  return notes.map((note) => ({
    id: note.id,
    postId: note.postId,
    projectId: note.projectId,
    author: note.author,
    body: note.body,
    slide: note.slide,
    createdAt: note.createdAt,
  }));
}

export async function kbSearch(input: unknown) {
  const data = readInput<{ projectId: string; query: string; types?: string[] }>("kb_search", input);
  return searchKb(data.projectId, data.query, { types: data.types, limit: 20 }).map((entry) => ({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    body: entry.body.slice(0, 600),
    tags: entry.tags,
    pillar: entry.pillar,
    source: entry.source,
  }));
}

export async function kbContextFor(input: unknown) {
  const data = readInput<{ projectId: string; topic?: string; format?: string; pillar?: string }>(
    "kb_context_for",
    input,
  );
  return contextFor(data.projectId, data);
}

export async function kbGet(input: unknown) {
  const data = readInput<{ projectId: string; entryId: string }>("kb_get", input);
  const found = hubEntry(data.projectId, data.entryId);
  if (!found) throw new Error("Entry not found");
  return {
    id: found.entry.id,
    type: found.entry.type,
    title: found.entry.title,
    body: found.entry.body,
    tags: found.entry.tags,
    pillar: found.entry.pillar,
    status: found.entry.status,
    source: found.entry.source,
    versions: found.versions.length,
    posts: found.posts.map((post) => ({ id: post.id, headline: post.headline })),
  };
}

export async function resultsOverview(input: unknown) {
  const data = readInput<{ projectId: string }>("results_overview", input);
  const { model } = await resultsBundle(data.projectId);
  return {
    weekStart: model.weekStart,
    weekEnd: model.weekEnd,
    lines: model.lines,
    followerDays: model.followerDays,
  };
}

export async function resultsPosts(input: unknown) {
  const data = readInput<{ projectId: string; sort?: "date" | "reach" | "sends" | "saves" }>("results_posts", input);
  const { model } = await resultsBundle(data.projectId);
  const rows = model.rows.toSorted((a, b) => {
    if (data.sort === "reach") return (b.reach ?? -1) - (a.reach ?? -1);
    if (data.sort === "sends") return (b.sendsPerReach ?? -1) - (a.sendsPerReach ?? -1);
    if (data.sort === "saves") return (b.savesPerReach ?? -1) - (a.savesPerReach ?? -1);
    return b.postedAt - a.postedAt;
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    date: row.dateLabel,
    format: row.formatLabel,
    pillar: row.pillar,
    reach: row.reach,
    sends: row.sendsLabel,
    saves: row.savesLabel,
    watch: row.watchLabel,
  }));
}

export async function resultsTakeaways(input: unknown) {
  const data = readInput<{ projectId: string }>("results_takeaways", input);
  const { model } = await resultsBundle(data.projectId);
  return model.takeaways.map((item) => ({
    id: item.id,
    text: item.text,
    numbers: item.numbers,
  }));
}

export async function reportWeek(input: unknown) {
  const data = readInput<{ projectId: string; week?: string }>("report_week", input);
  const { model } = await resultsBundle(data.projectId);
  const week = data.week ?? model.weekStart;
  const report = await buildWeekReport(data.projectId, week, "");
  return { weekStart: report.start, weekEnd: report.end, markdown: report.markdown };
}

export async function assetsSearch(input: unknown) {
  const data = readInput<{ projectId: string; query?: string; kind?: string; tag?: string; feature?: string }>(
    "assets_search",
    input,
  );
  const query = data.query?.trim().toLowerCase();
  const rows = await listAssets(data.projectId, { kind: data.kind, tag: data.tag, feature: data.feature });
  return rows
    .filter((asset) => {
      if (!query) return true;
      const hay = [asset.feature, asset.note, asset.path, ...asset.tags].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(query);
    })
    .map((asset) => ({
      id: asset.id,
      path: asset.path,
      kind: asset.kind,
      feature: asset.feature,
      tags: asset.tags,
      note: asset.note,
    }));
}

export async function ideasList(input: unknown) {
  const data = readInput<{ projectId: string; status?: string }>("ideas_list", input);
  if (data.status && !isIdeaStatus(data.status)) throw new Error("Unknown idea status");
  const ideas = listIdeas(sqlite, data.projectId).filter((idea) => !data.status || idea.status === data.status);
  return ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    body: idea.body,
    pillar: idea.pillar,
    format: idea.format,
    tags: idea.tags,
    status: idea.status,
    dueWeek: idea.dueWeek,
    postId: idea.postId,
    createdBy: idea.createdBy,
  }));
}

export async function copyCheck(input: unknown) {
  const data = readInput<{
    projectId: string;
    text: string;
    channel?: StudioChannel;
    postId?: string;
    hashtags?: string;
  }>("copy_check", input);
  if (data.postId) {
    const post = await db.query.generatedPosts.findFirst({
      where: and(eq(generatedPosts.id, data.postId), eq(generatedPosts.projectId, data.projectId)),
    });
    if (!post) throw new Error("Post not found in this project");
    const draft =
      data.channel && data.channel !== "instagram"
        ? {
            variants: {
              [data.channel]: {
                caption: data.text,
                hashtags: data.hashtags ?? null,
                firstComment: "",
              },
            },
          }
        : undefined;
    const issues = await reviewQueueCopy(post, data.text, data.hashtags ?? post.hashtags ?? "", draft);
    return { issues: issueView(issues) };
  }
  const sources = studioSources(data.projectId, data.text);
  const issues = checkStudioCopy({
    caption: data.text,
    hashtags: data.hashtags ?? "",
    allowedNumbers: sources.numbers.map((item) => item.value),
    banned: sources.banned,
    voiceRules: sources.voiceRules,
    format: studioFormat(null),
    altTexts: [""],
    altRequired: false,
    primary: data.channel === "facebook" ? "facebook" : "instagram",
  });
  return { issues: issueView(issues) };
}
