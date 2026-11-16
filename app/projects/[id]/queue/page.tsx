import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  autopilotConfig,
  generatedPosts,
  projects,
  socialChannels,
} from "@/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { TriangleAlert } from "lucide-react";
import { WeekPlan } from "@/components/queue/WeekPlan";
import { timing } from "@/lib/queue-rules";
import { FormatFilter } from "@/components/queue/FormatFilter";
import { PostRow } from "@/components/queue/PostRow";
import { ApproveWeek } from "@/components/queue/ApproveWeek";
import { openNotes } from "@/lib/queue-actions";
import { PostSheet } from "@/components/queue/PostSheet";
import { automationLine } from "@/lib/queue-context";
import { RefreshStats } from "@/components/queue/RefreshStats";
import {
  connectionState,
  KIND_LABELS,
  postLabel,
  postsInView,
  QUEUE_VIEWS,
  queueKind,
  VIEW_LABELS,
  viewCounts,
  type QueueView,
} from "@/lib/queue-view";
import {
  formatDayTime,
  formatTime,
  nextDailyRun,
  nextOpenSlot,
  projectSlots,
  QUEUE_ZONE_LABEL,
} from "@/lib/queue-schedule";
import { storedInsights } from "@/lib/queue-insights";

export const dynamic = "force-dynamic";
export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    kind?: string;
    post?: string;
    at?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [posts, project, channel, autopilot] = await Promise.all([
    db.query.generatedPosts.findMany({
      where: eq(generatedPosts.projectId, id),
      orderBy: [desc(generatedPosts.createdAt)],
    }),
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    db.query.socialChannels.findFirst({
      where: and(
        eq(socialChannels.projectId, id),
        eq(socialChannels.platform, "instagram"),
      ),
    }),
    db.query.autopilotConfig.findFirst({
      where: eq(autopilotConfig.projectId, id),
    }),
  ]);
  if (!project) notFound();
  // Server request time, evaluated once for this dynamic response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now(),
    connection = connectionState(channel, now),
    username =
      channel?.igUsername ??
      project.name.toLowerCase().replace(/\s+/g, "");
  const view: QueueView = QUEUE_VIEWS.includes(search.view as QueueView)
    ? (search.view as QueueView)
    : "review";
  const kind =
    search.kind && Object.hasOwn(KIND_LABELS, search.kind)
      ? search.kind
      : "all";
  // Open notes: the owner's change requests put a post in the "With Claude" lane.
  const open = await openNotes({ projectId: id });
  const withClaude = new Set(
    open.filter((n) => n.author !== "claude").map((n) => n.postId),
  );
  const noteByPost = new Map(open.map((n) => [n.postId, n]));
  const visible = postsInView(posts, view, kind, withClaude),
    counts = viewCounts(posts, kind, withClaude);
  const href = (updates: {
    view?: string;
    kind?: string;
    post?: string;
    at?: string;
  }) => {
    const params = new URLSearchParams({
      view,
      ...(kind !== "all" ? { kind } : {}),
      ...updates,
    });
    return `/projects/${id}/queue?${params}`;
  };
  const nextRun = nextDailyRun(autopilot?.cronTime, now);
  // What will really happen next, in plain words (not the state of a switch).
  const noTime = posts.filter((p) => timing(p, now) === "no-time");
  const nextOut = posts
    .filter((p) => timing(p, now) === "scheduled")
    .sort((a, b) => a.scheduledAt! - b.scheduledAt!)[0];
  const automation = await automationLine(id, autopilot, now);
  const slots = projectSlots(project);
  const published = postsInView(posts, "published"),
    recent = published.filter(
      (p) => p.postedAt != null && p.postedAt >= now - 30 * 86400000,
    );
  const stats = recent.map((p) => ({
    post: p,
    ...storedInsights(p.insightsJson),
  }));
  const hasData = stats.some((s) => Object.keys(s.metrics).length > 0);
  const reached = stats.filter((s) => s.metrics.reach != null);
  const sum = (key: "saved" | "shares") => {
    const values = stats.flatMap((s) =>
      s.metrics[key] != null ? [s.metrics[key]!] : [],
    );
    return values.length
      ? values.reduce((a, b) => a + b, 0).toLocaleString()
      : "None yet";
  };
  const account = [...published]
    .sort((a, b) => (b.insightsUpdatedAt ?? 0) - (a.insightsUpdatedAt ?? 0))
    .map((p) => storedInsights(p.insightsJson).account)
    .find((a) => a?.followers != null);
  const best = stats
    .filter((s) => s.metrics.saved != null)
    .sort((a, b) => b.metrics.saved! - a.metrics.saved!)[0];
  const allStats = published.map((p) => storedInsights(p.insightsJson));
  const permissionError = allStats.some(
      (s) => s.permissionError || s.accountPermissionError,
    ),
    statsErrors = [
      ...new Set(
        allStats.flatMap((s) =>
          [s.error, s.accountError].filter((value): value is string => !!value),
        ),
      ),
    ];
  const lastPublished = published[0]?.postedAt;
  const brandColor = project.brandColor ?? "#40b0c8";
  const empty: Record<QueueView, [string, string]> = {
    review: [
      "All caught up",
      autopilot?.enabled
        ? `Next autopilot run ${formatTime(nextRun)}. New posts will wait here for review.`
        : "Autopilot is off. New posts will appear here when queued.",
    ],
    claude: [
      "Nothing with Claude",
      "When you ask for a change on a post, it waits here until Claude has fixed it.",
    ],
    "up-next": [
      "Nothing scheduled yet",
      "Approve a post from Review. It is scheduled for the time shown on its Approve button.",
    ],
    published: [
      "No published posts yet",
      "Approved posts appear here after Instagram confirms publishing. Stats refresh every six hours.",
    ],
    declined: [
      "No declined posts",
      "Posts you decline stay here. Move one back to Review when it is ready.",
    ],
    drafts: [
      "No drafts",
      "Unfinished posts stay here until you move them to Review.",
    ],
  };
  // "Approve all with a time": waiting posts whose proposed time is still ahead.
  const waiting = postsInView(posts, "review", "all", withClaude);
  const ready = waiting.filter((p) => timing(p, now) === "proposed");
  const notReady = waiting
    .filter((p) => timing(p, now) !== "proposed")
    .map((p) => ({
      label: postLabel(p),
      reason:
        timing(p, now) === "proposal-passed"
          ? "its proposed time has passed"
          : "no time proposed",
    }));
  const MAIN_VIEWS = ["review", "claude", "up-next", "published"] as const;
  return (
    <div
      className="mx-auto max-w-[1440px] space-y-8"
      style={
        {
          "--queue-accent": brandColor,
        } as CSSProperties
      }
    >
      <header className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {view === "review"
            ? visible.length
              ? `${visible.length} ${visible.length === 1 ? "post" : "posts"} waiting for you`
              : "All caught up"
            : VIEW_LABELS[view]}
        </h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="break-all">@{username}</span>
          <span aria-hidden="true">·</span>
          {connection.active ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--queue-accent)]" />
              {connection.label}
            </span>
          ) : (
            <Link
              href={`/api/auth/instagram?projectId=${id}`}
              className="inline-flex min-h-11 items-center text-link underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {connection.label}
            </Link>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {nextOut
              ? `Next out ${formatDayTime(nextOut.scheduledAt)}`
              : "Nothing scheduled"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{automation}</span>
          <span aria-hidden="true">·</span>
          <span>{QUEUE_ZONE_LABEL} time</span>
        </div>
      </header>
      {noTime.length > 0 && view !== "up-next" && (
        <Link
          href={href({ view: "up-next" })}
          className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <TriangleAlert className="size-4 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">
            {noTime.length === 1
              ? "1 approved post has no time and will not go out."
              : `${noTime.length} approved posts have no time and will not go out.`}
          </span>
          <span className="shrink-0 underline">Give a time</span>
        </Link>
      )}
      {!connection.active && (
        <aside
          className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"
          aria-label="Instagram connection required"
        >
          <span>Publishing and stats are paused.</span>
          <Link
            href={`/api/auth/instagram?projectId=${id}`}
            className="inline-flex min-h-11 items-center text-link underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Reconnect
          </Link>
        </aside>
      )}
      <div className="flex min-w-0 flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <nav
          className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
          aria-label="Queue views"
        >
          {MAIN_VIEWS.map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-current={view === v ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${view === v ? "border-b-2 border-link font-medium text-link" : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {VIEW_LABELS[v]}
              <span className={`text-xs tabular-nums ${view === v ? "text-current" : "text-muted-foreground"}`}>
                {counts[v]}
              </span>
            </Link>
          ))}
          <FormatFilter
            label={
              view === "declined" || view === "drafts"
                ? `${VIEW_LABELS[view]} ${counts[view]}`
                : "More"
            }
            options={(["declined", "drafts"] as const).map((v) => ({
              label: `${VIEW_LABELS[v]} (${counts[v]})`,
              href: href({ view: v }),
              active: view === v,
            }))}
          />
        </nav>
        <FormatFilter
          label={
            kind === "all"
              ? "All formats"
              : KIND_LABELS[kind as keyof typeof KIND_LABELS]
          }
          options={[["all", "All formats"], ...Object.entries(KIND_LABELS)].map(
            ([key, label]) => ({
              label,
              href: href({ kind: key }),
              active: key === kind,
            }),
          )}
        />
      </div>
      {view === "published" && (
        <section className="space-y-4" aria-label="Last 30 days performance">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Last 30 days</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Last published{" "}
                {lastPublished
                  ? formatTime(lastPublished)
                  : "No published posts"}
                .
              </p>
            </div>
            <RefreshStats projectId={id} connected={connection.active} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Posts published", String(recent.length)],
              ["Followers", account?.followers?.toLocaleString() ?? "None yet"],
              [
                "Average reach",
                reached.length
                  ? Math.round(
                      reached.reduce((a, s) => a + s.metrics.reach!, 0) /
                        reached.length,
                    ).toLocaleString()
                  : "None yet",
              ],
              ["Total saves", sum("saved")],
              ["Total shares", sum("shares")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {reached.length > 0 && reached.length < 3 && (
            <p className="text-sm text-muted-foreground">
              Too few posts to compare an average. The counts above still stand.
            </p>
          )}
          {!hasData && (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              {connection.active
                ? "No data yet. Refresh stats after publishing."
                : "No data yet. Reconnect Instagram, then refresh."}
            </p>
          )}
          {best && (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              Best by saves:{" "}
              <Link
                href={href({ post: best.post.id })}
                className="text-foreground underline"
              >
                {postLabel(best.post)}
              </Link>
              <span className="ml-2 tabular-nums">
                {best.metrics.saved} saves
              </span>
            </p>
          )}
          {permissionError && (
            <p role="alert" className="text-xs text-muted-foreground">
              Insights permission is missing. Reconnect Instagram to grant
              instagram_business_manage_insights. The new permission takes
              effect on your next reconnect.
            </p>
          )}
          {statsErrors.length > 0 && !permissionError && (
            <p role="status" className="text-xs text-muted-foreground">
              Last stats refresh: {statsErrors.join(". ")}. Previously fetched
              data remains visible.
            </p>
          )}
        </section>
      )}
      {visible.length === 0 ? (
        <div className="py-4">
          {view !== "review" && (
            <h3 className="text-sm font-medium">
              {kind === "all"
                ? empty[view][0]
                : `No ${KIND_LABELS[kind as keyof typeof KIND_LABELS].toLowerCase()} posts in ${VIEW_LABELS[view]}`}
            </h3>
          )}
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {kind === "all"
              ? empty[view][1]
              : `No ${KIND_LABELS[kind as keyof typeof KIND_LABELS].toLowerCase()} posts in ${VIEW_LABELS[view]}. Choose All formats to see the rest.`}
          </p>
        </div>
      ) : (
        <section className="space-y-3" aria-label={VIEW_LABELS[view]}>
          {view === "review" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Tap a post to see it in full, change its time or ask for a
                change.
              </p>
              <ApproveWeek
                projectId={id}
                ready={ready.map((p) => ({
                  id: p.id,
                  label: postLabel(p),
                  time: formatDayTime(p.scheduledAt),
                }))}
                notReady={notReady}
              />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {visible.map((post) => {
              const note = noteByPost.get(post.id);
              return (
                <PostRow
                  key={post.id}
                  post={post}
                  href={href({ post: post.id })}
                  now={now}
                  note={
                    note
                      ? {
                          body: note.body,
                          slide: note.slide,
                          fromClaude: note.author === "claude",
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      )}
      {view === "up-next" && (
        <WeekPlan
          posts={
            kind === "all" ? posts : posts.filter((p) => queueKind(p) === kind)
          }
          now={now}
          projectId={id}
          postHref={(postId) => href({ post: postId })}
          nextSlot={(post) => nextOpenSlot(post, posts, now, slots)}
          rhythm={slots}
        />
      )}
      <PostSheet
        postId={search.post}
        posts={posts}
        viewIds={visible.map((p) => p.id)}
        listLabel={VIEW_LABELS[view]}
        slots={slots}
        username={username}
        connected={connection.active}
        brandColor={brandColor}
        now={now}
      />
    </div>
  );
}
