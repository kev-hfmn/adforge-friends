import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { QueueImage } from "@/components/queue/Media";
import { GiveTime } from "@/components/queue/GiveTime";
import { postLabel, type QueuePost } from "@/lib/queue-view";
import {
  formatDayTime,
  localInput,
  QUEUE_ZONE_LABEL,
  type WeeklySlot,
} from "@/lib/queue-schedule";
import { timing, type Timing } from "@/lib/queue-rules";
import { StatusChip } from "@/components/studio/StatusChip";

const WORD: Partial<Record<Timing, string>> = {
  scheduled: "Scheduled",
  due: "Due, next hourly run",
  proposed: "Needs your OK",
  "proposal-passed": "Needs your OK, time passed",
  failed: "Failed",
  posted: "Posted",
};
const dayOf = (at: number) => localInput(at).slice(0, 10);
const timeOf = (at: number) => localInput(at).slice(11);

function Thumb({ post }: { post: QueuePost }) {
  return (
    <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border">
      <QueueImage src={post.imagePath} alt="" fit="cover" compact />
    </div>
  );
}

/**
 * The next seven days as they really are: every post sits on the day of its own time,
 * whatever that time is. Approved posts without a time get a loud block of their own.
 */
export function WeekPlan({
  posts,
  now,
  projectId,
  postHref,
  nextSlot,
  rhythm,
}: {
  posts: QueuePost[];
  now: number;
  projectId: string;
  postHref: (postId: string) => string;
  nextSlot: (post: QueuePost) => number;
  /** The project's usual week, shown as a hint on empty days. Empty = no hints. */
  rhythm: ReadonlyArray<WeeklySlot>;
}) {
  const today = new Date(`${dayOf(now)}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const first = dayOf(now);
  const planned = posts
    .map((post) => ({
      post,
      state: timing(post, now),
      at: post.status === "posted" ? post.postedAt : post.scheduledAt,
    }))
    .filter(
      (row): row is typeof row & { at: number } =>
        row.at != null && row.state !== "off" && row.state !== "no-time",
    )
    .sort((a, b) => a.at - b.at);
  const noTime = posts.filter((p) => timing(p, now) === "no-time");
  // Still waiting from before today: approved and due, or failed. They belong to no day below.
  const stuck = planned.filter(
    (row) =>
      dayOf(row.at) < first && (row.state === "due" || row.state === "failed"),
  );
  return (
    <section className="space-y-4" aria-label="The next seven days">
      {(noTime.length > 0 || stuck.length > 0) && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4"
        >
          {noTime.length > 0 && (
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div>
                <h3 className="text-sm font-medium">
                  {noTime.length === 1
                    ? "1 approved post has no time"
                    : `${noTime.length} approved posts have no time`}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  They will not go out until they get one. Tap a time to
                  schedule, or open the post to pick another.
                </p>
              </div>
            </div>
          )}
          {noTime.map((post) => {
            const at = nextSlot(post);
            return (
              <div
                key={post.id}
                className="flex flex-wrap items-center gap-3 border-t border-amber-500/20 pt-3"
              >
                <Thumb post={post} />
                <Link
                  href={postHref(post.id)}
                  scroll={false}
                  className="min-w-0 flex-1 basis-40 text-sm underline-offset-2 hover:underline"
                >
                  {postLabel(post)}
                </Link>
                <div className="flex items-center gap-2">
                  <GiveTime
                    postId={post.id}
                    projectId={projectId}
                    at={at}
                    label={formatDayTime(at)}
                  />
                  <Link
                    href={postHref(post.id)}
                    scroll={false}
                    className="inline-flex min-h-10 items-center px-2 text-xs underline"
                  >
                    Other time
                  </Link>
                </div>
              </div>
            );
          })}
          {stuck.map(({ post, state, at }) => (
            <div
              key={post.id}
              className="flex flex-wrap items-center gap-3 border-t border-amber-500/20 pt-3 first:border-0 first:pt-0"
            >
              <Thumb post={post} />
              <Link
                href={postHref(post.id)}
                scroll={false}
                className="min-w-0 flex-1 basis-40 text-sm underline-offset-2 hover:underline"
              >
                {postLabel(post)}
              </Link>
              <span className="text-xs text-muted-foreground">
                {state === "failed"
                  ? `Failed on ${formatDayTime(at)}. Open it to try again.`
                  : `Was due ${formatDayTime(at)} and is still waiting.`}
              </span>
            </div>
          ))}
        </div>
      )}
      <div>
        <h3 className="text-sm font-medium">Next 7 days</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Every post on the day it is set for. Times are {QUEUE_ZONE_LABEL} time.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        {days.map((date) => {
          const key = date.toISOString().slice(0, 10);
          const rows = planned.filter((row) => dayOf(row.at) === key);
          const usual = rhythm.length
            ? rhythm.filter(
                (r) => r.days.includes(date.getUTCDay()),
              ).map((r) => `${r.label} ${String(r.hour).padStart(2, "0")}:00`)
            : [];
          return (
            <div
              key={key}
              className="grid grid-cols-1 gap-2 border-b border-border p-4 last:border-0 md:grid-cols-[120px_1fr] md:gap-4"
            >
              <h4
                className={`pt-1 text-xs font-medium ${key === first ? "text-[var(--queue-accent)]" : ""}`}
              >
                {key === first ? "Today · " : ""}
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "UTC",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(date)}
              </h4>
              <div className="space-y-1">
                {rows.map(({ post, state, at }) => (
                  <Link
                    key={post.id}
                    href={postHref(post.id)}
                    scroll={false}
                    className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="w-11 shrink-0 text-sm tabular-nums">
                      {timeOf(at)}
                    </span>
                    <Thumb post={post} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {postLabel(post)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <StatusChip word={WORD[state] ?? state} />
                        <span className="text-xs text-muted-foreground">{WORD[state] ?? state}</span>
                      </span>
                    </span>
                  </Link>
                ))}
                {!rows.length && (
                  <p className="flex min-h-8 items-center text-xs text-muted-foreground">
                    Nothing planned
                    {usual.length > 0 && ` · usual rhythm: ${usual.join(", ")}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
