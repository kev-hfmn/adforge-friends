// Pure cross-posting rules: which posts go where, and what each channel is sent.
// No database or network here; scripts/check-crosspost.ts exercises them.
import { slidesFor, targetChannel, type QueuePost } from "@/lib/queue-view";
import type { ZernioPost, ZernioPostRequest } from "@/lib/zernio";

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};
/** TikTok goes through Zernio; Facebook is direct on our Meta app. */
export const CROSSPOST_PROVIDERS = ["zernio", "meta"];

export type CrosspostChannel = {
  platform: string | null;
  provider: string | null;
  accountId: string | null;
  createdAt: number | null;
};
type Publication = { postId: string; platform: string };
type MediaPost = Pick<
  QueuePost,
  "templateType" | "caption" | "hashtags" | "imagePath" | "videoPath" | "carouselSlides"
>;

/** Why this post does not go to this platform, or null when it does. */
export function skipReason(
  post: Pick<QueuePost, "templateType"> & Partial<Pick<QueuePost, "metadata">>,
  platform: string,
): string | null {
  // A Facebook-only post goes to the Page directly (lib/crosspost.ts publishFacebookOnly).
  if (targetChannel({ metadata: post.metadata ?? null }) === "facebook")
    return platform === "facebook" ? "Facebook-only post: sent directly, not cross-posted" : "Facebook-only post";
  // TikTok rewards motion: reels and swipeable carousels. Single cards stay off it.
  if (platform === "tiktok" && post.templateType !== "reel" && post.templateType !== "carousel")
    return "TikTok gets reels and carousels only";
  return null;
}

/** Posts that went live on Instagram after a channel was linked and have no row for it yet. */
export function duePublications(
  posts: (Pick<QueuePost, "id" | "status" | "postedAt" | "templateType"> & Partial<Pick<QueuePost, "metadata">>)[],
  channels: CrosspostChannel[],
  existing: Publication[],
): Publication[] {
  const done = new Set(existing.map((p) => `${p.postId}:${p.platform}`));
  const due: Publication[] = [];
  for (const channel of channels) {
    if (!CROSSPOST_PROVIDERS.includes(channel.provider ?? "")) continue;
    if (!channel.accountId || !channel.platform) continue;
    for (const post of posts) {
      if (post.status !== "posted" || post.postedAt == null) continue;
      // Linking a channel never back-fills the archive.
      if (post.postedAt < (channel.createdAt ?? Infinity)) continue;
      if (skipReason(post, channel.platform)) continue;
      if (done.has(`${post.id}:${channel.platform}`)) continue;
      due.push({ postId: post.id, platform: channel.platform });
    }
  }
  return due;
}

export type PostMedia =
  | { kind: "video"; url: string }
  | { kind: "images"; urls: string[] }
  | { kind: "image"; url: string };

export function absoluteUrl(path: string, baseUrl: string): string {
  return /^https?:\/\//.test(path)
    ? path
    : `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export type CaptionVariant = { caption: string | null; hashtags: string | null };

/** Caption and hashtags for one channel. A null field inherits the main post. */
export function resolvedCaption(
  post: { caption: string | null; hashtags: string | null },
  variant?: CaptionVariant | null,
): { caption: string | null; hashtags: string | null } {
  if (!variant) return { caption: post.caption, hashtags: post.hashtags };
  return {
    caption: variant.caption != null ? variant.caption : post.caption,
    hashtags: variant.hashtags != null ? variant.hashtags : post.hashtags,
  };
}

/** The post's caption and absolute media URLs, checked against the channel's image limit. */
export function postMedia(
  post: MediaPost,
  baseUrl: string,
  imageLimit: number,
  variant?: CaptionVariant | null,
): { text: string; media: PostMedia } {
  const absolute = (path: string) =>
    /^https?:\/\//.test(path)
      ? path
      : `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const resolved = resolvedCaption(post, variant);
  const text = [resolved.caption, resolved.hashtags].filter(Boolean).join("\n\n");
  if (post.templateType === "reel") {
    if (!post.videoPath) throw new Error("The reel has no video");
    return { text, media: { kind: "video", url: absolute(post.videoPath) } };
  }
  if (post.templateType === "carousel") {
    const slides = slidesFor(post);
    if (slides.length < 2 || slides.some((s) => !s.imagePath))
      throw new Error("The carousel has unrendered slides");
    if (slides.length > imageLimit) throw new Error(`At most ${imageLimit} images per post here`);
    return { text, media: { kind: "images", urls: slides.map((s) => absolute(s.imagePath!)) } };
  }
  if (!post.imagePath) throw new Error("The post has no image");
  return { text, media: { kind: "image", url: absolute(post.imagePath) } };
}

/**
 * The caption as each channel should read it. "Link in bio" becomes `link`.
 * Pass null to leave the words unchanged (a project that has no site yet).
 * The site comes from the project's `bio_link` (Setup).
 */
export function channelText(text: string, platform: string, link: string | null = null): string {
  if (!link) return text;
  const bare = link.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const href =
    platform === "facebook"
      ? `https://${bare}${bare.includes("/") ? "" : "/"}?utm_source=facebook&utm_medium=social&utm_campaign=crosspost`
      : bare;
  return text.replace(/link in bio\.?/gi, href);
}

/** Facebook takes at most 10 photos in one post. */
export const FACEBOOK_IMAGE_LIMIT = 10;

export function tiktokRequest(
  post: MediaPost,
  accountId: string,
  baseUrl: string,
  variant?: CaptionVariant | null,
  link: string | null = null,
): ZernioPostRequest {
  const { text, media } = postMedia(post, baseUrl, 35, variant);
  return {
    content: channelText(text, "tiktok", link),
    mediaItems:
      media.kind === "video"
        ? [{ type: "video", url: media.url }]
        : media.kind === "images"
          ? media.urls.map((url) => ({ type: "image" as const, url }))
          : [{ type: "image", url: media.url }],
    platforms: [
      {
        platform: "tiktok",
        accountId,
        // Our reels often open on black; use the same cover Instagram shows.
        ...(media.kind === "video" && post.imagePath
          ? { platformSpecificData: { videoCoverImageUrl: absoluteUrl(post.imagePath, baseUrl) } }
          : {}),
      },
    ],
    publishNow: true,
    tiktokSettings: {
      privacy_level: "PUBLIC_TO_EVERYONE",
      allow_comment: true,
      // Off so our facts are not cut into someone else's fear video.
      allow_duet: false,
      allow_stitch: false,
      // The owner saw this exact post with its preview and approved it in AdForge.
      content_preview_confirmed: true,
      express_consent_given: true,
    },
  };
}

/** Map Zernio's answer for one platform onto our row. */
export function publicationOutcome(
  post: ZernioPost,
  platform: string,
): { status: "posted" | "failed" | "publishing"; url: string | null; error: string | null } {
  const entry = post.platforms?.find((p) => p.platform === platform) ?? post.platforms?.[0];
  const state = entry?.status ?? post.status;
  if (state === "published" && entry?.platformPostUrl)
    return { status: "posted", url: entry.platformPostUrl, error: null };
  if (state === "published") return { status: "posted", url: null, error: null };
  if (state === "failed" || state === "cancelled")
    return {
      status: "failed",
      url: null,
      error: entry?.errorMessage || entry?.error || `Zernio marked it ${state}`,
    };
  return { status: "publishing", url: null, error: null };
}
