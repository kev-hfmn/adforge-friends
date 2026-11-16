import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, socialChannels } from "@/drizzle/schema";
import { PostDetail, type CopyContext } from "@/components/queue/PostDetail";
import { facebookConnected, metadata, targetChannel, type QueuePost } from "@/lib/queue-view";
import { nextOpenSlot, type WeeklySlot } from "@/lib/queue-schedule";
import { queueCopyContext } from "@/lib/queue-copy";
import { notesFor } from "@/lib/queue-actions";
import { listActivity } from "@/lib/api/audit";
import { postHubLinks } from "@/lib/kb";
import { publicationsFor } from "@/lib/crosspost";
import { copyMode } from "@/lib/project-rules";
import { studioSources } from "@/lib/studio-sources";
import { snippetsFor, variantsFor } from "@/lib/studio-store";

/**
 * The post sheet, loadable from any project page: pass `?post=<id>` through and it
 * opens over that page (Posts, Week or Home) with the same checks and actions.
 */
export async function PostSheet({
  postId,
  posts,
  viewIds,
  listLabel,
  slots,
  username,
  connected,
  brandColor,
  now,
}: {
  postId: string | undefined;
  posts: QueuePost[];
  /** The posts the arrows step through, in order. */
  viewIds: string[];
  /** What that list is, for "2 of 4 in <label>". */
  listLabel: string;
  /** The project's usual posting week, for the "next free slot" suggestion. */
  slots: ReadonlyArray<WeeklySlot>;
  username: string;
  connected: boolean;
  brandColor: string;
  now: number;
}) {
  if (!postId) return null;
  const post = posts.find((p) => p.id === postId);
  if (!post)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        This post is unavailable in this project. Choose another post.
      </p>
    );
  let copyContext: CopyContext = null,
    copyError: string | null = null;
  try {
    copyContext = queueCopyContext(post);
  } catch (e) {
    copyError = e instanceof Error ? e.message : "Copy source unavailable";
  }
  // A Facebook-only post is gated on the Facebook Page, not on Instagram.
  const facebookOnly = targetChannel(post) === "facebook";
  const facebookChannel = facebookOnly && post.projectId
    ? await db.query.socialChannels.findFirst({
        where: and(eq(socialChannels.projectId, post.projectId), eq(socialChannels.platform, "facebook")),
      })
    : undefined;
  return (
    <PostDetail
      key={post.id}
      post={post}
      username={username}
      connected={facebookOnly ? facebookConnected(facebookChannel) : connected}
      gridPosts={posts
        .filter((p) => (p.status === "approved" || p.status === "posted") && targetChannel(p) === "instagram")
        .sort(
          (a, b) =>
            (b.postedAt ?? b.createdAt ?? 0) - (a.postedAt ?? a.createdAt ?? 0),
        )
        .slice(0, 9)}
      viewIds={viewIds}
      listLabel={listLabel}
      notes={await notesFor(post.id)}
      kbLinks={postHubLinks(post.id)}
      publications={await publicationsFor(post.id)}
      nextSlot={nextOpenSlot(post, posts, now, slots)}
      copyContext={copyContext}
      copyError={copyError}
      brandColor={brandColor}
      referenceNow={now}
      variantRows={await variantsFor(post.id)}
      hub={post.projectId ? studioSources(post.projectId, post.headline ?? metadata(post).topic ?? "") : { numbers: [], banned: [], voiceRules: [], checklist: [], related: [] }}
      snippets={post.projectId ? await snippetsFor(post.projectId) : []}
      activity={post.projectId ? listActivity(post.projectId, post.id) : []}
      mode={copyMode(
        post.projectId
          ? ((await db.query.projects.findFirst({ where: eq(projects.id, post.projectId) })) ?? { id: post.projectId })
          : { id: "" },
      )}
    />
  );
}
