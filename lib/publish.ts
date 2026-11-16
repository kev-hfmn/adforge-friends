import { db } from "@/lib/db";
import {
  autopilotConfig,
  generatedPosts,
  socialChannels,
} from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  publishPhoto,
  publishReel,
  publishCarousel,
  fetchPermalink,
} from "@/lib/instagram";
import {
  assertPublishable,
  publishRenderedPost,
} from "@/lib/queue-publish";
import { renderPost } from "@/lib/render";
import { crosspostPost, publishFacebookOnly } from "@/lib/crosspost";
import { targetChannel } from "@/lib/queue-view";

const publishing = new Set<string>();
/**
 * Publish a post where it belongs: Instagram (then TikTok and Facebook follow), or,
 * for a Facebook-only post, straight to the Facebook Page.
 */
export async function publishPostToInstagram(
  postId: string,
  projectId: string,
): Promise<void> {
  if (publishing.has(postId))
    throw new Error("This post is already publishing");
  const target = await db.query.generatedPosts.findFirst({
    where: and(eq(generatedPosts.id, postId), eq(generatedPosts.projectId, projectId)),
    columns: { metadata: true },
  });
  if (target && targetChannel(target) === "facebook") {
    publishing.add(postId);
    try {
      return await publishFacebookOnly(postId);
    } finally {
      publishing.delete(postId);
    }
  }
  publishing.add(postId);
  try {
    const channel = await db.query.socialChannels.findFirst({
      where: and(
        eq(socialChannels.projectId, projectId),
        eq(socialChannels.platform, "instagram"),
      ),
    });
    if (!channel?.accessToken || !channel.igUserId)
      throw new Error("No Instagram account connected for this project");
    const post = await db.query.generatedPosts.findFirst({
      where: and(
        eq(generatedPosts.id, postId),
        eq(generatedPosts.projectId, projectId),
      ),
    });
    if (!post) throw new Error("Post not found");
    // Autopilot posts may publish straight from pending when the project allows it.
    const config =
      post.status === "pending"
        ? await db.query.autopilotConfig.findFirst({
            where: eq(autopilotConfig.projectId, projectId),
          })
        : null;
    const automatic =
      !!config?.enabled &&
      !!config.autoPostAfterApproval &&
      post.source === "autopilot";
    assertPublishable(post, channel, automatic);
    if (!post.imagePath && post.templateType !== "carousel")
      post.imagePath = await renderPost(postId);
    const token = channel.accessToken,
      userId = channel.igUserId;
    await publishRenderedPost(
      post,
      process.env.BASE_URL || "http://localhost:3000",
      {
        photo: (url, caption) => publishPhoto(token, userId, url, caption),
        reel: (url, caption, cover) =>
          publishReel(token, userId, url, caption, cover),
        carousel: (urls, caption) =>
          publishCarousel(token, userId, urls, caption),
        recordPublished: async (mediaId) => {
          await db
            .update(generatedPosts)
            .set({
              status: "posted",
              postedAt: Date.now(),
              igMediaId: mediaId,
              publishError: null,
            })
            .where(eq(generatedPosts.id, postId));
        },
        permalink: (mediaId) => fetchPermalink(token, mediaId),
        recordPermalink: async (permalink) => {
          await db
            .update(generatedPosts)
            .set({ permalink })
            .where(eq(generatedPosts.id, postId));
        },
      },
    );
  } finally {
    publishing.delete(postId);
  }
  // Instagram is live; TikTok and Facebook follow. Their failures stay on their own
  // rows and never touch the Instagram result.
  try {
    await crosspostPost(postId);
  } catch (err) {
    console.error(`[Crosspost] ${postId}:`, err);
  }
}
