"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QueueImage } from "@/components/queue/Media";
import { formatDayTime, localTimestamp } from "@/lib/queue-schedule";
import { schedulePost } from "@/app/projects/[id]/queue/actions";

export type WeekItem = {
  id: string;
  /** "18:00", or null when the post has no time yet. */
  time: string | null;
  label: string;
  word: string;
  tone: string;
  imagePath: string | null;
  href: string;
  /** Only posts in review or approved can be moved. */
  movable: boolean;
  numbers?: string;
};
export type WeekDay = {
  key: string; // YYYY-MM-DD in the queue's time zone
  name: string; // "Mon"
  date: string; // "10 Nov"
  today: boolean;
  past: boolean;
  hint: string | null;
  items: WeekItem[];
};

function Card({
  item,
  onDragStart,
}: {
  item: WeekItem;
  onDragStart?: (id: string) => void;
}) {
  return (
    <Link
      href={item.href}
      scroll={false}
      draggable={item.movable}
      onDragStart={(e) => {
        if (!item.movable) return;
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(item.id);
      }}
      className={`flex min-h-14 items-center gap-3 rounded-lg border border-border bg-card p-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:flex-col md:items-stretch md:gap-2 ${item.movable ? "md:cursor-grab" : ""}`}
    >
      <span className="block aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-md border border-border md:aspect-[5/4] md:w-full">
        <QueueImage src={item.imagePath} alt="" fit="cover" compact />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          {item.time && (
            <span className="text-sm font-medium tabular-nums">{item.time}</span>
          )}
          <span className={`truncate text-xs ${item.tone}`}>{item.word}</span>
        </span>
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground md:text-foreground">
          {item.label}
        </span>
        {item.numbers && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">
            {item.numbers}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * One week. On a phone: a list by day, tap a post to open it and change its time there.
 * On a wide screen: seven columns, and a post can also be dragged to another day
 * (it keeps its time of day; a post without one lands on the default hour).
 */
export function WeekBoard({
  projectId,
  days,
  unplaced,
  defaultTime,
}: {
  projectId: string;
  days: WeekDay[];
  /** Posts in review without a proposed time: drag one onto a day, or open it. */
  unplaced: WeekItem[];
  defaultTime: string;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const all = [...unplaced, ...days.flatMap((d) => d.items)];
  const drop = (day: WeekDay, id: string) => {
    setOver(null);
    const item = all.find((i) => i.id === id);
    if (!item?.movable) return;
    if (day.items.some((i) => i.id === id)) return;
    const at = localTimestamp(`${day.key}T${item.time ?? defaultTime}`);
    start(async () => {
      try {
        await schedulePost(id, projectId, at);
        toast.success(`Moved to ${formatDayTime(at)}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not move it");
      }
    });
  };
  return (
    <div className={`space-y-4 ${busy ? "opacity-70" : ""}`}>
      {unplaced.length > 0 && (
        <section
          aria-label="Waiting for review, no time proposed"
          className="space-y-2 rounded-xl border border-border p-3"
        >
          <h3 className="text-xs font-medium text-muted-foreground">
            In review, no time yet ({unplaced.length}).{" "}
            <span className="hidden md:inline">
              Drag one onto a day, or open it to pick a time.
            </span>
            <span className="md:hidden">Open one to pick a time.</span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
            {unplaced.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border md:grid-cols-7">
        {days.map((day) => (
          <section
            key={day.key}
            aria-label={`${day.name} ${day.date}`}
            onDragOver={(e) => {
              if (day.past) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== day.key) setOver(day.key);
            }}
            onDragLeave={() => setOver((k) => (k === day.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault();
              drop(day, e.dataTransfer.getData("text/plain"));
            }}
            className={`flex min-w-0 gap-3 border-b border-border p-3 last:border-0 md:min-h-72 md:flex-col md:gap-2 md:border-b-0 md:border-r md:last:border-r-0 ${over === day.key ? "bg-[var(--queue-accent)]/10" : ""} ${day.past ? "opacity-60" : ""}`}
          >
            <h3
              className={`w-14 shrink-0 text-xs md:w-auto ${day.today ? "font-semibold text-[var(--queue-accent)]" : "font-medium"}`}
            >
              <span className="block md:inline">{day.name}</span>{" "}
              <span className="text-muted-foreground md:text-inherit">
                {day.date}
              </span>
              {day.today && <span className="block md:inline"> · today</span>}
            </h3>
            <div className="min-w-0 flex-1 space-y-2">
              {day.items.map((item) => (
                <Card key={item.id} item={item} />
              ))}
              {!day.items.length && (
                <p className="flex min-h-10 items-center text-xs text-muted-foreground md:items-start">
                  {day.past ? "Nothing went out" : "Nothing planned"}
                  {day.hint && !day.past ? `. Usual: ${day.hint}` : ""}
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
