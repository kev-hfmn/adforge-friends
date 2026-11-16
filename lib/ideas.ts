// Idea rules. No database and no network. Nothing here publishes or approves.
import { nextOpenSlot, type WeeklySlot } from "./queue-schedule";
import type { QueuePost } from "./queue-view";

export const IDEA_STATUSES = ["inbox", "shaping", "ready", "planned", "done", "dropped"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_COLUMNS: { id: IdeaStatus; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "shaping", label: "Shaping" },
  { id: "ready", label: "Ready" },
  { id: "planned", label: "Planned" },
  { id: "done", label: "Done" },
  { id: "dropped", label: "Dropped" },
];

export function isIdeaStatus(value: string): value is IdeaStatus {
  return (IDEA_STATUSES as readonly string[]).includes(value);
}

export type IdeaLinks = {
  urls: string[];
  assetIds: string[];
  sourcePostId: string | null;
  sourceKey?: string;
};

export function parseLinks(raw: string | null | undefined): IdeaLinks {
  try {
    const value = JSON.parse(raw || "{}") as Partial<IdeaLinks>;
    return {
      urls: Array.isArray(value.urls) ? value.urls.filter((item) => typeof item === "string") : [],
      assetIds: Array.isArray(value.assetIds)
        ? value.assetIds.filter((item) => typeof item === "string")
        : [],
      sourcePostId: typeof value.sourcePostId === "string" ? value.sourcePostId : null,
      sourceKey: typeof value.sourceKey === "string" ? value.sourceKey : undefined,
    };
  } catch {
    return { urls: [], assetIds: [], sourcePostId: null };
  }
}

export function shapeForFormat(format: string | null): {
  templateType: string;
  layoutStyle: string | null;
} {
  if (format === "reel") return { templateType: "reel", layoutStyle: null };
  if (format === "photo") return { templateType: "ad", layoutStyle: null };
  return { templateType: "carousel", layoutStyle: null };
}

/** The next free rhythm slot for a draft of this format. The draft itself stays unscheduled. */
export function offeredSlotForFormat(
  format: string | null,
  posts: readonly QueuePost[],
  now: number,
  rhythm: readonly WeeklySlot[],
): number {
  const shape = shapeForFormat(format);
  const probe = {
    id: "idea-draft",
    status: "draft",
    scheduledAt: null,
    templateType: shape.templateType,
    layoutStyle: shape.layoutStyle,
    metadata: null,
  } as QueuePost;
  return nextOpenSlot(probe, [...posts], now, rhythm);
}

export function takeawayDraft(
  label: string,
  mode: "reel" | "again",
): { title: string; body: string; format: "reel" } {
  const clean = label
    .replace(/[—–]/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim()
    .slice(0, 120);
  const name = clean || "That post";
  if (mode === "reel") {
    return {
      title: `Reel: ${name}`.slice(0, 140),
      body: "From Results. Make a reel from this post. The source post stays as it is.",
      format: "reel",
    };
  }
  return {
    title: `Another: ${name}`.slice(0, 140),
    body: "From Results. Plan another post like this one. The source post stays as it is.",
    format: "reel",
  };
}
