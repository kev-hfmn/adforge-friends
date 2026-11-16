import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDayTime } from "@/lib/queue-schedule";
import { IdeaKeys } from "@/components/ideas/IdeaKeys";
import { IdeasBoard } from "@/components/ideas/IdeasBoard";
import { PostSheet } from "@/components/queue/PostSheet";
import { proposeOfferedSlot } from "./actions";
import { sqlite } from "@/lib/db";
import { offeredSlotForFormat } from "@/lib/ideas";
import { listIdeas } from "@/lib/ideas-store";
import { loadQueueContext } from "@/lib/queue-context";

export const dynamic = "force-dynamic";

export default async function IdeasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ post?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const context = await loadQueueContext(id, now);
  if (!context) notFound();
  const ideas = listIdeas(sqlite, id);
  const open = search.post ? context.posts.find((post) => post.id === search.post) : undefined;
  const linked = open ? ideas.find((idea) => idea.postId === open.id) : undefined;
  const offeredAt =
    linked && open?.status === "draft"
      ? offeredSlotForFormat(linked.format, context.posts, now, context.slots)
      : null;
  const base = `/projects/${id}`;

  return (
    <div
      className="mx-auto max-w-[1440px] space-y-4"
      style={
        {
          "--queue-accent": context.brandColor,
        } as CSSProperties
      }
    >
      <IdeaKeys projectId={id} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-medium tracking-tight">Ideas</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            A backlog you and Claude share. Nothing here publishes.
          </p>
          <p className="text-xs text-muted-foreground">I captures an idea. Drag a title, or use Move.</p>
        </div>
        <Link
          href={`${base}/ideas/new`}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring"
        >
          + Idea
        </Link>
      </header>

      {linked && offeredAt != null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="max-w-xl text-sm">
            Draft created. Next open slot is {formatDayTime(offeredAt)}. Propose this time to put it in
            review. It does not go out until you approve it.
          </p>
          <form action={proposeOfferedSlot}>
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="ideaId" value={linked.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              Propose this time
            </button>
          </form>
        </div>
      ) : null}

      <IdeasBoard
        projectId={id}
        ideas={ideas.map((idea) => ({
          id: idea.id,
          title: idea.title,
          body: idea.body,
          pillar: idea.pillar,
          format: idea.format,
          status: idea.status,
          createdBy: idea.createdBy,
          postId: idea.postId,
        }))}
      />
      <PostSheet
        postId={search.post}
        posts={context.posts}
        viewIds={search.post ? [search.post] : []}
        listLabel="Ideas"
        slots={context.slots}
        username={context.username}
        connected={context.connection.active}
        brandColor={context.brandColor}
        now={now}
      />
    </div>
  );
}
