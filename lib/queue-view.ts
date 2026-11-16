import type { generatedPosts } from "@/drizzle/schema";

export type QueuePost = typeof generatedPosts.$inferSelect;
export type QueueKind = "correction" | "film" | "other";
export const QUEUE_VIEWS = [
  "review",
  "claude",
  "up-next",
  "published",
  "declined",
  "drafts",
] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];
export const VIEW_LABELS: Record<QueueView, string> = {
  review: "Needs review",
  claude: "With Claude",
  "up-next": "Scheduled",
  published: "Posted",
  declined: "Declined",
  drafts: "Drafts",
};
export const KIND_LABELS: Record<QueueKind, string> = {
  correction: "Fact check",
  film: "Film",
  other: "Other",
};
export type QueueMeta = {
  trigger?: string;
  title?: string;
  caption?: string;
  queueEditedAt?: number;
  postType?: string;
  facts?: string; // checked facts a fact-check post's copy is gated against
  altText?: string;
  topic?: string;
  spec?: string; // the JSON spec the post was built from
  channel?: "facebook"; // Facebook only: publishes to the Page, never to Instagram or TikTok
  location?: string;
  /** Story-gate lines the writer ticked. Recorded, never a block. */
  storyGate?: string[];
  /** Warning codes the reviewer chose to override. Blocks cannot be overridden. */
  warningOverrides?: string[];
};
export type QueueSlide = {
  imagePath?: string;
  headlineStart?: string;
  headlineHighlight?: string;
  subtext?: string;
  ctaText?: string;
};
export function metadata(post: Pick<QueuePost, "metadata">): QueueMeta {
  try {
    const value = JSON.parse(post.metadata ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function slidesFor(
  post: Pick<QueuePost, "carouselSlides">,
): QueueSlide[] {
  try {
    const value: unknown = JSON.parse(post.carouselSlides ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is QueueSlide => !!v && typeof v === "object")
      : [];
  } catch {
    return [];
  }
}
export function queueKind(
  post: Pick<QueuePost, "templateType" | "layoutStyle" | "metadata">,
): QueueKind {
  const meta = metadata(post);
  // A post whose copy is gated against checked facts (metadata.facts).
  if (meta.postType === "chart-correction") return "correction";
  // A finished video (product film, ordinary reel): postType "film".
  if (meta.postType === "film") return "film";
  return "other";
}
export function postLabel(post: QueuePost): string {
  return post.headline || (post.templateType === "reel" ? "Reel" : "Feed post");
}
export function mediaRatio(post: Pick<QueuePost, "templateType">): string {
  return post.templateType === "reel" ? "9 / 16" : "4 / 5";
}
/**
 * `withClaude`: ids of posts with an open change request. They are still `pending`
 * in the database (so they cannot go out) but sit in their own lane, not the reviewer's.
 */
export function postsInView(
  posts: QueuePost[],
  view: QueueView,
  kind?: string,
  withClaude: ReadonlySet<string> = new Set(),
): QueuePost[] {
  return posts
    .filter(
      (p) =>
        (!kind || kind === "all" || queueKind(p) === kind) &&
        (view === "review"
          ? p.status === "pending" && !withClaude.has(p.id)
          : view === "claude"
            ? p.status === "pending" && withClaude.has(p.id)
          : view === "up-next"
            ? p.status === "approved" || p.status === "failed"
            : view === "published"
              ? p.status === "posted"
              : view === "declined"
                ? p.status === "declined"
                : p.status === "draft"),
    )
    .sort((a, b) =>
      view === "up-next" || view === "review" || view === "claude"
        ? (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) ||
          (b.createdAt ?? 0) - (a.createdAt ?? 0)
        : view === "published"
          ? (b.postedAt ?? 0) - (a.postedAt ?? 0)
          : (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
}
export function viewCounts(
  posts: QueuePost[],
  kind?: string,
  withClaude: ReadonlySet<string> = new Set(),
) {
  return Object.fromEntries(
    QUEUE_VIEWS.map((view) => [
      view,
      postsInView(posts, view, kind, withClaude).length,
    ]),
  ) as Record<QueueView, number>;
}
/** Where a post goes live. Default Instagram (then cross-posted); "facebook" is Facebook only. */
export function targetChannel(post: Pick<QueuePost, "metadata">): "instagram" | "facebook" {
  return metadata(post).channel === "facebook" ? "facebook" : "instagram";
}
/** A Facebook Page channel can publish: it has a Page token and a Page id. */
export function facebookConnected(
  channel: { accessToken?: string | null; accountId?: string | null } | null | undefined,
): boolean {
  return !!channel?.accessToken && !!channel.accountId;
}
export function connectionState(
  channel:
    | {
        accessToken?: string | null;
        igUserId?: string | null;
        tokenExpiresAt?: number | null;
      }
    | null
    | undefined,
  now = Date.now(),
) {
  if (!channel?.accessToken || !channel.igUserId)
    return { active: false, label: "Not connected" };
  if (channel.tokenExpiresAt != null && channel.tokenExpiresAt <= now)
    return { active: false, label: "Expired, reconnect" };
  const days =
    channel.tokenExpiresAt == null
      ? null
      : Math.ceil((channel.tokenExpiresAt - now) / 86400000);
  return {
    active: true,
    label: days != null && days <= 30 ? `Expires in ${days}d` : "Connected",
  };
}
