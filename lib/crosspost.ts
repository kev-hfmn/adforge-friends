// Cross-posting: once a post is live on Instagram, the same post goes to the project's
// other channels: TikTok through Zernio, Facebook direct on our Meta app. Instagram stays the gate, so
// everything that reaches TikTok or Facebook already passed the owner's approval.
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  generatedPosts,
  postPublications,
  projects,
  socialChannels,
} from "@/drizzle/schema";
import { zernioPost, zernioPublish } from "@/lib/zernio";
import {
  facebookPermalink,
  facebookVideoState,
  publishFacebookAlbum,
  publishFacebookPhoto,
  publishFacebookReel,
  setFacebookThumbnail,
} from "@/lib/facebook";
import {
  CROSSPOST_PROVIDERS,
  absoluteUrl,
  channelText,
  FACEBOOK_IMAGE_LIMIT,
  duePublications,
  postMedia,
  publicationOutcome,
  tiktokRequest,
} from "@/lib/crosspost-rules";
import { bioLinkFor } from "@/lib/project-rules";
import { facebookConnected, targetChannel } from "@/lib/queue-view";
import { renderPost } from "@/lib/render";
import { variantDraft } from "@/lib/studio-store";

type Outcome = {
  externalId: string | null;
  status: "posted" | "failed" | "publishing";
  url: string | null;
  error: string | null;
};
type Post = typeof generatedPosts.$inferSelect;
type Channel = typeof socialChannels.$inferSelect;
const baseUrl = () => process.env.BASE_URL || "http://localhost:3000";

async function sendTikTok(post: Post, channel: Channel, rowId: string, link: string | null): Promise<Outcome> {
  const variant = await variantDraft(post.id, "tiktok");
  const result = await zernioPublish(
    tiktokRequest(
      post,
      channel.accountId!,
      baseUrl(),
      variant && { caption: variant.caption ?? null, hashtags: variant.hashtags ?? null },
      link,
    ),
    rowId,
  );
  return { externalId: result._id, ...publicationOutcome(result, "tiktok") };
}

async function sendFacebook(post: Post, channel: Channel, link: string | null): Promise<Outcome> {
  const token = channel.accessToken;
  if (!token) throw new Error("Facebook is not connected. Reconnect the Page.");
  const pageId = channel.accountId!;
  const variant = await variantDraft(post.id, "facebook");
  const { text: raw, media } = postMedia(
    post,
    baseUrl(),
    FACEBOOK_IMAGE_LIMIT,
    variant && { caption: variant.caption ?? null, hashtags: variant.hashtags ?? null },
  );
  const text = channelText(raw, "facebook", link);
  if (media.kind === "video") {
    // Reels finish processing after publishing; the hourly run fills in the link.
    const videoId = await publishFacebookReel(pageId, token, media.url, text);
    if (post.imagePath)
      await setFacebookThumbnail(videoId, token, absoluteUrl(post.imagePath, baseUrl())).catch((e) =>
        console.error(`[Crosspost] Facebook thumbnail for ${post.id}:`, e),
      );
    return { externalId: videoId, status: "publishing", url: null, error: null };
  }
  const id =
    media.kind === "images"
      ? await publishFacebookAlbum(pageId, token, media.urls, text)
      : await publishFacebookPhoto(pageId, token, media.url, text);
  const url = await facebookPermalink(id, token).catch(() => null);
  return { externalId: id, status: "posted", url, error: null };
}

/** For a row still "publishing": its outcome now, or null while it is still in progress. */
async function checkPending(
  row: typeof postPublications.$inferSelect,
  channel: Channel | undefined,
): Promise<Omit<Outcome, "externalId"> | null> {
  if (!row.externalId) return null;
  if (row.platform === "facebook") {
    if (!channel?.accessToken) return null;
    const state = await facebookVideoState(row.externalId, channel.accessToken);
    if (state === "processing") return null;
    if (state === "error")
      return { status: "failed", url: null, error: "Facebook could not process the reel" };
    return {
      status: "posted",
      url: await facebookPermalink(row.externalId, channel.accessToken).catch(() => null),
      error: null,
    };
  }
  const outcome = publicationOutcome(await zernioPost(row.externalId), row.platform);
  return outcome.status === "publishing" ? null : outcome;
}

/** Whether this channel can send at all on this server. */
function usable(channel: Channel): boolean {
  if (channel.provider === "zernio") return !!process.env.ZERNIO_API_KEY;
  return channel.provider === "meta" && !!channel.accessToken;
}

// ─── Effects ──────────────────────────────────────────────────────────────────

const sending = new Set<string>();

async function send(postId: string, platform: string): Promise<void> {
  const lock = `${postId}:${platform}`;
  if (sending.has(lock)) return;
  sending.add(lock);
  try {
    const post = await db.query.generatedPosts.findFirst({
      where: eq(generatedPosts.id, postId),
    });
    if (!post?.projectId) return;
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, post.projectId),
    });
    const link = bioLinkFor(project);
    const channel = await db.query.socialChannels.findFirst({
      where: and(
        eq(socialChannels.projectId, post.projectId),
        eq(socialChannels.platform, platform),
      ),
    });
    if (!channel?.accountId || !usable(channel)) return;
    const existing = await db.query.postPublications.findFirst({
      where: and(
        eq(postPublications.postId, postId),
        eq(postPublications.platform, platform),
      ),
    });
    if (existing) return;
    // Written before the send: a crash leaves "publishing", never a second copy.
    const [row] = await db
      .insert(postPublications)
      .values({ postId, projectId: post.projectId, platform, status: "publishing" })
      .returning();
    try {
      const outcome =
        platform === "tiktok"
          ? await sendTikTok(post, channel, row.id, link)
          : await sendFacebook(post, channel, link);
      await db
        .update(postPublications)
        .set({ ...outcome, postedAt: outcome.status === "posted" ? Date.now() : null })
        .where(eq(postPublications.id, row.id));
    } catch (e) {
      await db
        .update(postPublications)
        .set({ status: "failed", error: e instanceof Error ? e.message : String(e) })
        .where(eq(postPublications.id, row.id));
    }
  } finally {
    sending.delete(lock);
  }
}

/**
 * Publish a Facebook-only post (metadata.channel "facebook") to the Page. Same gate as
 * Instagram: approved, reel rendered, not already out. The post is marked posted once
 * Facebook has it; a reel's link arrives on a later hourly run.
 */
export async function publishFacebookOnly(postId: string): Promise<void> {
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post?.projectId) throw new Error("Post not found");
  if (targetChannel(post) !== "facebook") throw new Error("This post is not a Facebook-only post");
  if (post.status === "posted") throw new Error("This post has already been published");
  if (post.status !== "approved") throw new Error("Approve this post before publishing");
  if (post.templateType === "reel" && !post.videoPath)
    throw new Error("Render the reel video before publishing");
  const channel = await db.query.socialChannels.findFirst({
    where: and(eq(socialChannels.projectId, post.projectId), eq(socialChannels.platform, "facebook")),
  });
  if (!channel || !facebookConnected(channel) || !usable(channel))
    throw new Error("Facebook is not connected. Reconnect the Page.");
  if (!post.imagePath && post.templateType !== "carousel") await renderPost(postId);
  // A retry after a failed send starts clean; a row still publishing or posted stays (no second copy).
  await db
    .delete(postPublications)
    .where(and(eq(postPublications.postId, postId), eq(postPublications.platform, "facebook"), eq(postPublications.status, "failed")));
  await send(postId, "facebook");
  const row = await db.query.postPublications.findFirst({
    where: and(eq(postPublications.postId, postId), eq(postPublications.platform, "facebook")),
  });
  if (!row) throw new Error("Facebook did not take the post");
  if (row.status === "failed") throw new Error(row.error || "Facebook did not accept it");
  await db
    .update(generatedPosts)
    .set({ status: "posted", postedAt: Date.now(), permalink: row.url, publishError: null })
    .where(eq(generatedPosts.id, postId));
}

/** Send one post to every linked extra channel. Called right after Instagram succeeds. */
export async function crosspostPost(postId: string): Promise<void> {
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post?.projectId || post.status !== "posted") return;
  const channels = (
    await db.query.socialChannels.findMany({
      where: and(
        eq(socialChannels.projectId, post.projectId),
        inArray(socialChannels.provider, CROSSPOST_PROVIDERS),
      ),
    })
  ).filter(usable);
  const existing = await db.query.postPublications.findMany({
    where: eq(postPublications.postId, postId),
  });
  for (const due of duePublications([post], channels, existing))
    await send(due.postId, due.platform);
}

/** Hourly: catch posts the direct path missed, and fill in links reported late. */
export async function crosspostDue(): Promise<void> {
  const linked = await db.query.socialChannels.findMany({
    where: inArray(socialChannels.provider, CROSSPOST_PROVIDERS),
  });
  const channels = linked.filter(usable);
  if (channels.length) {
    const since = Math.min(...channels.map((c) => c.createdAt ?? Infinity));
    const posted = (
      await db.query.generatedPosts.findMany({
        where: eq(generatedPosts.status, "posted"),
      })
    ).filter((p) => (p.postedAt ?? 0) >= since);
    const existing = posted.length
      ? await db.query.postPublications.findMany({
          where: inArray(
            postPublications.postId,
            posted.map((p) => p.id),
          ),
        })
      : [];
    for (const project of new Set(channels.map((c) => c.projectId))) {
      const due = duePublications(
        posted.filter((p) => p.projectId === project),
        channels.filter((c) => c.projectId === project),
        existing,
      );
      for (const d of due) await send(d.postId, d.platform);
    }
  }
  // Still publishing, or published without a link yet (TikTok reports its link late).
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const pending = (
    await db.query.postPublications.findMany({
      where: inArray(postPublications.status, ["publishing", "posted"]),
    })
  ).filter(
    (r) =>
      r.status === "publishing" ||
      (r.platform === "tiktok" && !r.url && (r.postedAt ?? 0) > dayAgo),
  );
  for (const row of pending) {
    try {
      const channel = linked.find(
        (c) => c.projectId === row.projectId && c.platform === row.platform,
      );
      if (row.platform === "tiktok" && !process.env.ZERNIO_API_KEY) continue;
      const outcome = await checkPending(row, channel);
      if (!outcome) continue;
      if (row.status === "posted") {
        if (outcome.url)
          await db
            .update(postPublications)
            .set({ url: outcome.url })
            .where(eq(postPublications.id, row.id));
        continue;
      }
      await db
        .update(postPublications)
        .set({ ...outcome, postedAt: outcome.status === "posted" ? Date.now() : null })
        .where(eq(postPublications.id, row.id));
      // A Facebook-only post shows its Facebook link as the post's own link.
      if (outcome.url)
        await db
          .update(generatedPosts)
          .set({ permalink: outcome.url })
          .where(and(eq(generatedPosts.id, row.postId), isNull(generatedPosts.permalink), like(generatedPosts.metadata, '%"channel":"facebook"%')));
    } catch (e) {
      console.error(`[Crosspost] Status check failed for ${row.id}:`, e);
    }
  }
}

/** Clear a failed row so the next run sends that post again. */
export async function retryPublication(id: string): Promise<void> {
  const row = await db.query.postPublications.findFirst({
    where: eq(postPublications.id, id),
  });
  if (!row) throw new Error("Publication not found");
  if (row.status !== "failed") throw new Error("Only a failed send can be retried");
  await db.delete(postPublications).where(eq(postPublications.id, id));
  await send(row.postId, row.platform);
}

export type PublicationView = {
  id: string;
  platform: string;
  status: string | null;
  url: string | null;
  error: string | null;
};
/** For the post sheet. Tolerates a database copy that predates the table. */
export async function publicationsFor(postId: string): Promise<PublicationView[]> {
  try {
    return await db.query.postPublications.findMany({
      where: eq(postPublications.postId, postId),
      columns: { id: true, platform: true, status: true, url: true, error: true },
    });
  } catch (error) {
    if (/no such table/i.test(String(error))) return [];
    throw error;
  }
}

/**
 * Send an older post on purpose (the automatic flow only sends posts that went live
 * after a channel was linked). The owner's OK is needed for each call: this publishes.
 */
export async function crosspostNow(postId: string, platforms: string[]): Promise<void> {
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post) throw new Error("Post not found");
  if (post.status !== "posted") throw new Error("Only posts already live on Instagram go on");
  for (const platform of platforms) await send(postId, platform);
}

/** Replace the thumbnail of a reel already on Facebook with the post's cover image. */
export async function fixFacebookThumbnail(postId: string): Promise<void> {
  const row = await db.query.postPublications.findFirst({
    where: and(eq(postPublications.postId, postId), eq(postPublications.platform, "facebook")),
  });
  const post = await db.query.generatedPosts.findFirst({ where: eq(generatedPosts.id, postId) });
  if (!row?.externalId || !post?.imagePath || !post.projectId)
    throw new Error("No Facebook reel or no cover image for this post");
  const channel = await db.query.socialChannels.findFirst({
    where: and(eq(socialChannels.projectId, post.projectId), eq(socialChannels.platform, "facebook")),
  });
  if (!channel?.accessToken) throw new Error("Facebook is not connected");
  await setFacebookThumbnail(row.externalId, channel.accessToken, absoluteUrl(post.imagePath, baseUrl()));
}
