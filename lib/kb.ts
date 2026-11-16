// App-facing hub helpers. The buttons, the page and the scripts call these.
// A missing table (before migrate) does not throw: the queue still works.
import { sqlite } from "./db";
import {
  countTypes,
  createEntry,
  entriesByType,
  entryPosts,
  entryVersions,
  exportableEntries,
  hubHealth,
  linkCaption,
  linksForPost,
  listEntries,
  matchingExamples,
  readEntry,
  recentTaste,
  recordTaste,
  relinkProject,
  restoreVersion,
  searchEntries,
  setEntryStatus,
  updateEntry,
  type HubRow,
} from "./kb-store";

function missing(error: unknown): boolean {
  return /no such table/i.test(String(error));
}

function guard<T>(fallback: T, run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (missing(error)) return fallback;
    throw error;
  }
}

export type HubContext = { text: string; entryIds: string[] };

export function searchKb(
  projectId: string,
  query: string,
  opts: { types?: string[]; limit?: number } = {},
): HubRow[] {
  return guard([], () => searchEntries(sqlite, projectId, query, { ...opts, status: "active" }));
}

export function contextFor(
  projectId: string,
  opts: { topic?: string; format?: string; pillar?: string } = {},
): HubContext {
  return guard({ text: "", entryIds: [] }, () => {
    const rules = entriesByType(sqlite, projectId, ["banned", "voice_rule", "story_shape"], 50);
    const facts = opts.topic
      ? searchEntries(sqlite, projectId, opts.topic, { types: ["fact"], limit: 6 })
      : [];
    const myths = opts.topic
      ? searchEntries(sqlite, projectId, opts.topic, { types: ["myth"], limit: 3 })
      : [];
    const examples = matchingExamples(sqlite, projectId, opts);
    const taste = recentTaste(sqlite, projectId, 5);
    const seen = new Set<string>();
    const entries = [...rules, ...facts, ...myths, ...examples, ...taste].filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    return {
      entryIds: entries.map((entry) => entry.id),
      text: entries.map(contextLine).join("\n\n"),
    };
  });
}

function contextLine(entry: HubRow): string {
  if (entry.type === "banned") {
    const reason = typeof entry.fields.reason === "string" ? entry.fields.reason : "";
    const replacement = typeof entry.fields.replacement === "string" ? entry.fields.replacement : "";
    return `[banned ${entry.id}] ${entry.title}. ${reason}. Use: ${replacement}`;
  }
  const body = entry.body.replace(/\s+/g, " ").trim().slice(0, 420);
  return `[${entry.type} ${entry.id}] ${entry.title}\n${body}`;
}

export function captureTaste(input: {
  projectId: string | null | undefined;
  title: string;
  what: string;
  verdict: string;
  reason: string;
  before?: string;
  after?: string;
}) {
  if (!input.projectId) return;
  try {
    recordTaste(sqlite, { ...input, projectId: input.projectId });
  } catch (error) {
    if (!missing(error))
      console.error("[hub] taste draft was not saved:", error instanceof Error ? error.message : "unknown error");
  }
}

export function linkPost(projectId: string, postId: string, caption: string) {
  guard(0, () => linkCaption(sqlite, projectId, postId, caption));
}

export function postHubLinks(postId: string) {
  return guard([], () => linksForPost(sqlite, postId));
}

const emptyHealth: ReturnType<typeof hubHealth> = {
  factsNoSource: 0,
  pillarsWithoutExamples: [],
  warnings: [],
  unused: 0,
  drafts: 0,
};

export function hubOverview(projectId: string): {
  counts: { type: string; n: number }[];
  health: ReturnType<typeof hubHealth>;
} {
  return guard(
    { counts: [], health: emptyHealth },
    () => ({ counts: countTypes(sqlite, projectId), health: hubHealth(sqlite, projectId) }),
  );
}

export function hubList(
  projectId: string,
  opts: { q?: string; type?: string; status?: string },
): HubRow[] {
  return guard([], () => {
    if (opts.q?.trim())
      return searchEntries(sqlite, projectId, opts.q, {
        types: opts.type ? [opts.type] : undefined,
        status: opts.status || "active",
        limit: 40,
      });
    return listEntries(sqlite, projectId, { type: opts.type, status: opts.status || "active", limit: 80 });
  });
}

export function hubEntry(projectId: string, id: string) {
  return guard(null, () => {
    const entry = readEntry(sqlite, projectId, id);
    if (!entry) return null;
    const used = entryPosts(sqlite, id);
    return { entry, versions: entryVersions(sqlite, id), posts: used.posts, bestReach: used.bestReach };
  });
}

export {
  createEntry,
  exportableEntries,
  relinkProject,
  restoreVersion,
  setEntryStatus,
  updateEntry,
};
export { sqlite as hubSqlite };
