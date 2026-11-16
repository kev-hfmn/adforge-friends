"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueueImage } from "@/components/queue/Media";
import {
  KIND_LABELS,
  postLabel,
  queueKind,
  slidesFor,
  type QueuePost,
} from "@/lib/queue-view";
import { formatDayTime } from "@/lib/queue-schedule";
import { timing, type Timing } from "@/lib/queue-rules";
import { headlineNumbers, storedInsights } from "@/lib/queue-insights";
import { approvePost, undoDecision } from "@/app/projects/[id]/queue/actions";
import { StatusChip } from "@/components/studio/StatusChip";

const CHIP: Partial<Record<Timing, string>> = {
  scheduled: "Scheduled",
  due: "Due",
  proposed: "Needs your OK",
  "proposal-passed": "Time passed",
  "no-time": "No time",
  unplanned: "Needs your OK",
  failed: "Failed",
  posted: "Posted",
};

/** One post as a compact row: small picture, what it is, when it goes out, one action. */
export function PostRow({
  post,
  href,
  now,
  note,
}: {
  post: QueuePost;
  href: string;
  /** Server request time, so the row and the page agree on what "passed" means. */
  now: number;
  /** The newest open note on this post, shown under the title. */
  note?: { body: string; slide: number | null; fromClaude: boolean };
}) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const state = timing(post, now),
    slides = slidesFor(post).length,
    metrics = storedInsights(post.insightsJson).metrics;
  const when =
    {
      scheduled: `Scheduled ${formatDayTime(post.scheduledAt)}`,
      due: `Due ${formatDayTime(post.scheduledAt)}, goes out at the next hourly run`,
      "no-time": "Approved, no time. Will not go out.",
      proposed: `Proposed ${formatDayTime(post.scheduledAt)}`,
      "proposal-passed": `Proposed time passed (${formatDayTime(post.scheduledAt)})`,
      unplanned: "No time proposed",
      failed: `Failed: ${post.publishError || "Instagram did not accept it"}`,
      posted: `Posted ${formatDayTime(post.postedAt)}`,
      off: post.status === "declined" ? "Declined" : "Draft",
    }[state] ?? "";
  const approve = () =>
    start(async () => {
      try {
        await approvePost(post.id, post.projectId!, post.scheduledAt!);
        toast.success(`Approved for ${formatDayTime(post.scheduledAt)}`, {
          action: {
            label: "Undo",
            onClick: () =>
              start(async () => {
                try {
                  await undoDecision(
                    post.id,
                    post.projectId!,
                    post.status!,
                    post.scheduledAt,
                    "approved",
                  );
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Undo failed");
                }
              }),
          },
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not approve");
      }
    });
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border p-3 last:border-0 sm:flex-nowrap sm:p-4">
      <Link
        href={href}
        scroll={false}
        className="flex min-w-0 flex-1 basis-64 items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="block aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-md border border-border sm:w-16">
          <QueueImage src={post.imagePath} alt="" fit="cover" compact />
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="line-clamp-2 text-sm font-medium leading-snug">
            {postLabel(post)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {post.templateType === "reel"
              ? "Reel"
              : slides > 1
                ? `Carousel, ${slides} slides`
                : KIND_LABELS[queueKind(post)]}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusChip word={state === "off" && post.status === "declined" ? "Declined" : CHIP[state] ?? "Draft"} />
            <span className="text-xs tabular-nums text-muted-foreground">{when}</span>
          </span>
          {note && (
            <span className="flex items-start gap-1.5 pt-1 text-xs text-foreground">
              <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">
                {note.fromClaude ? "Claude: " : ""}
                {note.slide ? `Slide ${note.slide}: ` : ""}
                {note.body}
              </span>
            </span>
          )}
          {state === "posted" && (
            <span className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs tabular-nums">
              {headlineNumbers(metrics, post.templateType === "reel").map(
                (n) => (
                  <span key={n.label}>
                    <span className="text-muted-foreground">{n.label} </span>
                    <span className="font-medium">{n.value}</span>
                  </span>
                ),
              )}
            </span>
          )}
        </span>
      </Link>
      {state === "proposed" && !note ? (
        <Button
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={approve}
        >
          <Check />
          Approve for {formatDayTime(post.scheduledAt)}
        </Button>
      ) : state === "unplanned" || state === "proposal-passed" || state === "no-time" ? (
        <Button
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          nativeButton={false}
          render={<Link href={href} scroll={false} />}
        >
          Pick a time
        </Button>
      ) : (
        <Link
          href={href}
          scroll={false}
          aria-label={`Open ${postLabel(post)}`}
          className="hidden size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted sm:grid"
        >
          <ChevronRight className="size-4" />
        </Link>
      )}
    </article>
  );
}
