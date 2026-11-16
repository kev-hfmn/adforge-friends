import {
  connectionState,
  slidesFor,
  type QueuePost,
} from "./queue-view";

export type PublishChannel = {
  accessToken: string | null;
  igUserId: string | null;
  tokenExpiresAt: number | null;
};
export function assertPublishable(
  post: QueuePost,
  channel: PublishChannel,
  allowAutomatic = false,
  now = Date.now(),
) {
  if (!connectionState(channel, now).active)
    throw new Error("Publishing is paused. Reconnect Instagram.");
  if (post.status === "posted" || post.igMediaId)
    throw new Error("This post has already been published");
  if (
    post.status !== "approved" &&
    !(allowAutomatic && post.status === "pending")
  )
    throw new Error("Approve this post before publishing");
  if (post.templateType === "reel" && !post.videoPath)
    throw new Error("Render the reel video before publishing");
}
export type PublishEffects = {
  photo: (url: string, caption: string) => Promise<string>;
  reel: (url: string, caption: string, cover?: string) => Promise<string>;
  carousel: (urls: string[], caption: string) => Promise<string>;
  recordPublished: (mediaId: string) => Promise<void>;
  permalink: (mediaId: string) => Promise<string | null>;
  recordPermalink: (url: string) => Promise<void>;
};
// No DB, API or implicit effects: the same dispatch is exercised by local fixtures.
export async function publishRenderedPost(
  post: QueuePost,
  baseUrl: string,
  effects: PublishEffects,
): Promise<string> {
  const absolute = (path: string) =>
    /^https?:\/\//.test(path)
      ? path
      : `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
  let mediaId: string;
  if (post.templateType === "carousel") {
    const slides = slidesFor(post);
    if (slides.length < 2 || slides.some((s) => !s.imagePath))
      throw new Error("Carousel needs every slide rendered before publishing");
    mediaId = await effects.carousel(
      slides.map((s) => absolute(s.imagePath!)),
      caption,
    );
  } else if (post.templateType === "reel") {
    if (!post.videoPath)
      throw new Error("Render the reel video before publishing");
    mediaId = await effects.reel(
      absolute(post.videoPath),
      caption,
      post.imagePath ? absolute(post.imagePath) : undefined,
    );
  } else {
    if (!post.imagePath) throw new Error("Render the post before publishing");
    mediaId = await effects.photo(absolute(post.imagePath), caption);
  }
  await effects.recordPublished(mediaId);
  // Neither the lookup nor storing this optional link can undo a confirmed publish.
  try {
    const link = await effects.permalink(mediaId);
    if (link) await effects.recordPermalink(link);
  } catch {
    /* publish is already recorded */
  }
  return mediaId;
}
