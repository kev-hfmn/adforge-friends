import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { GiveTime } from "@/components/queue/GiveTime";
import { PlanBoard } from "@/components/plan/PlanBoard";
import { PostSheet } from "@/components/queue/PostSheet";
import { getBrandKitFields } from "@/lib/brand-kit";
import { db, sqlite } from "@/lib/db";
import { postPublications } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { listPlanEvents } from "@/lib/plan-events";
import {
  assemblePlan,
  bestTimeReason,
  clockMinutes,
  feedTiles,
  openSlots,
  parseDayKey,
  parsePlanView,
  periodOf,
  planDays,
  planHealth,
  planHref,
} from "@/lib/plan";
import { countIdeas } from "@/lib/ideas-store";
import { loadQueueContext } from "@/lib/queue-context";
import { postLabel } from "@/lib/queue-view";
import { formatDayTime, localInput, nextOpenSlot } from "@/lib/queue-schedule";
import { timing } from "@/lib/queue-rules";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string; v?: string; post?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const context = await loadQueueContext(id, now);
  if (!context) notFound();
  const today = localInput(now).slice(0, 10);
  const anchor = parseDayKey(search.w) ?? today;
  const explicit = parsePlanView(search.v);
  const view = explicit ?? "week";
  const period = periodOf(view, anchor);
  const days = planDays(period.grid, today, view === "month" ? anchor.slice(0, 7) : null);

  const [kit, events, publicationRows] = await Promise.all([
    getBrandKitFields(id),
    listPlanEvents(id, period.start, period.end),
    publicationsFor(id),
  ]);
  const noteCounts = new Map<string, number>();
  for (const note of context.openNotes)
    noteCounts.set(note.postId, (noteCounts.get(note.postId) ?? 0) + 1);
  const pillars = kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label }));
  const { placed, unplaced } = assemblePlan(
    context.posts,
    now,
    context.withClaude,
    publicationRows,
    pillars,
    noteCounts,
  );
  const slots = openSlots(period.grid, context.slots, placed, now);
  const inPeriod = placed.filter(
    (card) => card.day != null && card.day >= period.start && card.day <= period.end,
  );
  const tray = unplaced.filter((card) => card.word !== "No time");
  const planned = inPeriod.filter(
    (card) =>
      card.statusKey === "scheduled" || card.statusKey === "review" || card.statusKey === "claude",
  ).length;
  const ready = context.posts.filter((post) => {
    if (timing(post, now) !== "proposed" || context.withClaude.has(post.id) || post.scheduledAt == null)
      return false;
    const day = localInput(post.scheduledAt).slice(0, 10);
    return day >= period.start && day <= period.end;
  });
  const trayPosts = context.posts.filter((post) => timing(post, now) === "unplanned");
  const nextTime = Object.fromEntries(
    trayPosts.map((post) => [post.id, nextOpenSlot(post, context.posts, now, context.slots)]),
  );
  const clock = clockMinutes(now);
  const viewIds =
    view === "grid"
      ? feedTiles(placed).map((card) => card.id)
      : inPeriod.map((card) => card.id);
  const linkView = explicit;

  return (
    <div
      className="-mx-4 -my-6 flex h-[calc(100dvh-11rem)] min-h-0 flex-col gap-3 overflow-hidden px-4 py-3 md:-mx-8 md:-my-8 md:h-[calc(100dvh-8rem)] md:px-8"
      style={
        {
          "--queue-accent": context.brandColor,
        } as CSSProperties
      }
    >
      {context.noTime.length > 0 && (
        <div
          role="alert"
          className="shrink-0 space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4"
        >
          <p className="flex items-start gap-3 text-sm font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            {context.noTime.length === 1
              ? "1 approved post has no time and will not go out."
              : `${context.noTime.length} approved posts have no time and will not go out.`}
          </p>
          {context.noTime.map((post) => {
            const at = nextOpenSlot(post, context.posts, now, context.slots);
            return (
              <div
                key={post.id}
                className="flex flex-wrap items-center gap-3 border-t border-amber-500/20 pt-3"
              >
                <Link
                  href={planHref(id, today, anchor, linkView, post.id)}
                  scroll={false}
                  className="min-w-0 flex-1 basis-40 text-sm hover:underline"
                >
                  {postLabel(post)}
                </Link>
                <GiveTime postId={post.id} projectId={id} at={at} label={formatDayTime(at)} />
              </div>
            );
          })}
        </div>
      )}
      <PlanBoard
        projectId={id}
        view={view}
        responsive={explicit == null}
        anchor={anchor}
        today={today}
        title={period.title}
        prev={period.prev}
        next={period.next}
        days={days}
        placed={placed}
        tray={tray}
        slots={slots}
        events={events}
        health={planHealth({
          planned,
          openSlots: slots.length,
          needsTime: tray.length,
        })}
        bestTime={bestTimeReason(context.posts.filter((post) => post.status === "posted").length)}
        pillars={pillars.map((pillar) => pillar.label)}
        nextTime={nextTime}
        nowMinutes={period.grid.includes(clock.day) ? clock.minutes : null}
        ready={ready.map((post) => ({
          id: post.id,
          label: postLabel(post),
          time: formatDayTime(post.scheduledAt),
        }))}
        readyIdeas={countIdeas(sqlite, id, "ready")}
        ideasHref={`/projects/${id}/ideas`}
        rangeStart={period.start}
        rangeEnd={period.end}
      />
      <PostSheet
        postId={search.post}
        posts={context.posts}
        viewIds={viewIds}
        listLabel="this plan"
        slots={context.slots}
        username={context.username}
        connected={context.connection.active}
        brandColor={context.brandColor}
        now={now}
      />
    </div>
  );
}

async function publicationsFor(
  projectId: string,
): Promise<{ postId: string; platform: string; status: string | null }[]> {
  try {
    return await db.query.postPublications.findMany({
      where: eq(postPublications.projectId, projectId),
      columns: { postId: true, platform: true, status: true },
    });
  } catch (error) {
    if (/no such table/i.test(String(error))) return [];
    throw error;
  }
}
