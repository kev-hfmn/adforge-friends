import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { QueueImage } from "@/components/queue/Media";
import { PostSheet } from "@/components/queue/PostSheet";
import { RefreshStats } from "@/components/queue/RefreshStats";
import { loadQueueContext } from "@/lib/queue-context";
import { postLabel, postsInView, type QueuePost } from "@/lib/queue-view";
import { formatDayTime, formatTime, localInput } from "@/lib/queue-schedule";
import { timing } from "@/lib/queue-rules";
import { headlineNumbers, storedInsights } from "@/lib/queue-insights";
import { MondayView } from "@/components/home/MondayView";
import { getBrandKitFields } from "@/lib/brand-kit";
import { sqlite } from "@/lib/db";
import { countIdeas } from "@/lib/ideas-store";
import { assemblePlan, openSlots, periodOf, planDays } from "@/lib/plan";
import { assembleResults } from "@/lib/results-assemble";
import { loadResultSources } from "@/lib/results-store";
import { hubOverview } from "@/lib/kb";

export const dynamic = "force-dynamic";

function Thumb({ post }: { post: QueuePost }) {
  return (
    <span className="block aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-md border border-border">
      <QueueImage src={post.imagePath} alt="" fit="cover" compact />
    </span>
  );
}

/** One screen that answers: what needs me, what goes out next, how the last posts did. */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ post?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // Server request time, evaluated once for this dynamic response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [context, kit] = await Promise.all([
    loadQueueContext(id, now),
    getBrandKitFields(id),
  ]);
  if (!context) notFound();
  const { posts, withClaude, noTime, nextOut, connection, forOwner } = context;
  const pillars = kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label }));
  const sources = loadResultSources(sqlite, id);
  const results = sources
    ? assembleResults(sources, pillars, now, {
        plan: `/projects/${id}/plan`,
        post: (postId) => `/projects/${id}/queue?post=${postId}`,
      })
    : null;
  const today = localInput(now).slice(0, 10);
  const period = periodOf("week", today);
  const noteCounts = new Map<string, number>();
  for (const note of context.openNotes) noteCounts.set(note.postId, (noteCounts.get(note.postId) ?? 0) + 1);
  const { placed } = assemblePlan(posts, now, withClaude, [], pillars, noteCounts);
  const weekSlots = openSlots(period.grid, context.slots, placed, now);
  const weekCards = placed.filter((card) => card.day != null && card.day >= period.start && card.day <= period.end);
  const readyIdeas = countIdeas(sqlite, id, "ready");
  const tasteDrafts = hubOverview(id).health.drafts;
  const base = `/projects/${id}`;
  const open = (postId: string) => `${base}/home?post=${postId}`;

  const review = postsInView(posts, "review", "all", withClaude);
  const failed = posts.filter((p) => p.status === "failed");
  const due = posts.filter((p) => timing(p, now) === "due");
  const needs: { text: string; action: string; href: string; warn?: boolean }[] =
    [
      ...(connection.active
        ? []
        : [
            {
              text: "Instagram is not connected. Nothing can go out.",
              action: "Reconnect",
              href: `/api/auth/instagram?projectId=${id}`,
              warn: true,
            },
          ]),
      ...(noTime.length
        ? [
            {
              text:
                noTime.length === 1
                  ? "1 approved post has no time and will not go out"
                  : `${noTime.length} approved posts have no time and will not go out`,
              action: "Give a time",
              href: `${base}/plan`,
              warn: true,
            },
          ]
        : []),
      ...(failed.length
        ? [
            {
              text: `${failed.length} ${failed.length === 1 ? "post" : "posts"} failed to publish`,
              action: "Look",
              href: `${base}/queue?view=up-next`,
              warn: true,
            },
          ]
        : []),
      ...(review.length
        ? [
            {
              text: `${review.length} ${review.length === 1 ? "post" : "posts"} to review`,
              action: "Review",
              href: `${base}/queue?view=review`,
            },
          ]
        : []),
      ...(forOwner.length
        ? [
            {
              text: `${forOwner.length} ${forOwner.length === 1 ? "note" : "notes"} from Claude`,
              action: "Read",
              href: open(forOwner[0].postId),
            },
          ]
        : []),
    ];
  const upcoming = [...due, ...nextOut].slice(0, 5);
  const posted = postsInView(posts, "published").slice(0, 5);
  const account = postsInView(posts, "published")
    .sort((a, b) => (b.insightsUpdatedAt ?? 0) - (a.insightsUpdatedAt ?? 0))
    .map((p) => storedInsights(p.insightsJson))
    .find((s) => s.account?.followers != null);
  const statsAt = Math.max(0, ...posted.map((p) => p.insightsUpdatedAt ?? 0));
  const heading = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
  return (
    <div
      className="mx-auto max-w-[1440px] space-y-8"
      style={
        {
          "--queue-accent": context.brandColor,
        } as CSSProperties
      }
    >
      <section className="min-w-0 space-y-3" aria-labelledby="home-needs">
          <h2 id="home-needs" className={heading}>
            Needs you
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {needs.map((need) => (
              <Link
                key={need.text}
                href={need.href}
                className={`flex min-h-14 items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${need.warn ? "bg-amber-500/10" : ""}`}
              >
                {need.warn && (
                  <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                )}
                <span className="min-w-0 flex-1">{need.text}</span>
                <span className="flex shrink-0 items-center gap-1 text-[var(--queue-accent)]">
                  {need.action}
                  <ChevronRight className="size-4" />
                </span>
              </Link>
            ))}
            {!needs.length && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing. You are all caught up.
              </p>
            )}
          </div>
          {withClaude.size > 0 && (
            <Link
              href={`${base}/queue?view=claude`}
              className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {withClaude.size} with Claude, waiting for a change you asked for
            </Link>
          )}
      </section>
      <MondayView
        planHref={`${base}/plan`}
        resultsHref={`${base}/results`}
        ideasHref={`${base}/ideas`}
        hubHref={`${base}/hub`}
        days={planDays(period.grid, today, null)}
        cards={weekCards.map((card) => ({
          id: card.id,
          day: card.day,
          time: card.time,
          label: card.label,
        }))}
        slots={weekSlots}
        lines={results?.lines ?? []}
        takeaway={results?.takeaways[0] ? { text: results.takeaways[0].text, numbers: results.takeaways[0].numbers } : null}
        readyIdeas={readyIdeas}
        tasteDrafts={tasteDrafts}
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section className="min-w-0 space-y-3" aria-labelledby="home-next">
          <h2 id="home-next" className={heading}>
            Going out next
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {upcoming.map((post) => (
              <Link
                key={post.id}
                href={open(post.id)}
                scroll={false}
                className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 last:border-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Thumb post={post} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums">
                    {timing(post, now) === "due"
                      ? "Due, next hourly run"
                      : formatDayTime(post.scheduledAt)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {postLabel(post)}
                  </span>
                </span>
              </Link>
            ))}
            {!upcoming.length && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing is scheduled. Give a post a time on Plan.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {context.automation}.{" "}
            <Link
              href={`${base}/plan`}
              className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              See the plan
            </Link>
          </p>
        </section>

        <section className="min-w-0 space-y-3" aria-labelledby="home-last">
          <div className="flex items-center justify-between gap-3">
            <h2 id="home-last" className={heading}>
              Last posts
            </h2>
            <RefreshStats projectId={id} connected={connection.active} />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {posted.map((post) => (
              <Link
                key={post.id}
                href={open(post.id)}
                scroll={false}
                className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Thumb post={post} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-sm">
                    {postLabel(post)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDayTime(post.postedAt)}
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                    {headlineNumbers(
                      storedInsights(post.insightsJson).metrics,
                      post.templateType === "reel",
                    ).map((n) => (
                      <span key={n.label}>
                        <span className="text-muted-foreground">{n.label} </span>
                        <span className="font-medium">{n.value}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            ))}
            {!posted.length && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing posted yet. Approved posts show here after they go out.
              </p>
            )}
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {account?.account?.followers != null
              ? `${account.account.followers.toLocaleString()} followers. `
              : ""}
            {statsAt ? `Numbers from ${formatTime(statsAt)}.` : "No numbers yet."}
          </p>
        </section>
        </div>
      </MondayView>
      <p className="text-xs text-muted-foreground">
        @{context.username} · Instagram:{" "}
        {connection.active ? connection.label.toLowerCase() : "not connected"}
      </p>
      <PostSheet
        postId={search.post}
        posts={posts}
        viewIds={[...upcoming, ...posted].map((p) => p.id)}
        listLabel="Home"
        slots={context.slots}
        username={context.username}
        connected={connection.active}
        brandColor={context.brandColor}
        now={now}
      />
    </div>
  );
}
