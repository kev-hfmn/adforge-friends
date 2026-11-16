"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ApproveWeek } from "@/components/queue/ApproveWeek";
import { Agenda, DayBoard, FeedGrid, MonthGrid, WeekGrid } from "@/components/plan/grids";
import { Channels, StatusChip, Thumb } from "@/components/plan/bits";
import { addPlanEvent } from "@/app/projects/[id]/plan/actions";
import { clearPlanTime, schedulePost, startPlanPost } from "@/app/projects/[id]/queue/actions";
import { formatDayTime, localTimestamp, QUEUE_ZONE_LABEL } from "@/lib/queue-schedule";
import {
  EMPTY_FILTER,
  feedTiles,
  matchesFilter,
  movePlanTime,
  planHref,
  snapDrop,
  visibleHours,
  type PlanCard,
  type PlanDay,
  type PlanEvent,
  type PlanFilter,
  type PlanSlot,
  type PlanView,
} from "@/lib/plan";

const VIEWS: { id: PlanView; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "day", label: "Day" },
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
];

export function PlanBoard({
  projectId,
  view,
  responsive,
  anchor,
  today,
  title,
  prev,
  next,
  days,
  placed,
  tray,
  slots,
  events,
  health,
  bestTime,
  pillars,
  nextTime,
  nowMinutes,
  ready,
  readyIdeas,
  ideasHref,
  rangeStart,
  rangeEnd,
}: {
  projectId: string;
  view: PlanView;
  responsive: boolean;
  anchor: string;
  today: string;
  title: string;
  prev: string;
  next: string;
  days: PlanDay[];
  placed: PlanCard[];
  tray: PlanCard[];
  slots: PlanSlot[];
  events: PlanEvent[];
  health: string;
  bestTime: string;
  pillars: string[];
  nextTime: Record<string, number>;
  nowMinutes: number | null;
  ready: { id: string; label: string; time: string }[];
  readyIdeas: number;
  ideasHref: string;
  rangeStart: string;
  rangeEnd: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<PlanFilter>(EMPTY_FILTER);
  const [slot, setSlot] = useState<PlanSlot | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [overKey, setOverKey] = useState<string | null>(null);
  const dragged = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const linkView = responsive ? null : view;

  const go = useCallback(
    (day: string, nextView: PlanView | null = linkView) => {
      router.push(planHref(projectId, today, day, nextView));
    },
    [linkView, projectId, router, today],
  );
  const hrefFor = (id: string) => planHref(projectId, today, anchor, linkView, id);
  const dayHref = (day: string) => planHref(projectId, today, day, "day");

  const shown = useMemo(
    () =>
      placed.filter(
        (card) =>
          card.day != null &&
          card.day >= rangeStart &&
          card.day <= rangeEnd &&
          matchesFilter(card, filter),
      ),
    [placed, rangeStart, rangeEnd, filter],
  );
  const shownTray = tray.filter((card) => matchesFilter(card, filter));
  const hours = visibleHours(
    shown.map((card) => card.minutes ?? 0),
    slots.map((item) => item.hour),
  );
  const tiles = feedTiles(placed.filter((card) => matchesFilter(card, filter)));

  const moveTo = (id: string, at: number) => {
    const card = [...placed, ...tray].find((item) => item.id === id);
    if (!card) return;
    const status =
      card.statusKey === "posted"
        ? "posted"
        : card.statusKey === "failed"
          ? "failed"
          : card.statusKey === "scheduled"
            ? "approved"
            : "pending";
    const checked = movePlanTime({ status }, at, Date.now());
    if (!checked.ok) {
      toast.error(checked.reason);
      setOverKey(null);
      return;
    }
    const previous = card.at;
    start(async () => {
      try {
        await schedulePost(id, projectId, checked.at);
        toast.success(`Moved to ${formatDayTime(checked.at)}`, {
          action: {
            label: "Undo",
            onClick: () => {
              start(async () => {
                try {
                  if (previous == null) await clearPlanTime(id, projectId);
                  else await schedulePost(id, projectId, previous);
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not undo");
                }
              });
            },
          },
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not move it");
      } finally {
        setOverKey(null);
        setSlot(null);
      }
    });
  };

  const dropHour = (id: string, day: string, hour: number, offsetY: number, height: number) => {
    if (!id) return;
    const time = snapDrop(hour, offsetY, height);
    const at = localTimestamp(`${day}T${time}`);
    if (!Number.isFinite(at)) {
      toast.error("Choose a date and time");
      return;
    }
    moveTo(id, at);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target != null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "Escape") {
        setSlot(null);
        setTrayOpen(false);
        return;
      }
      if (typing || slot) {
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft") go(prev);
      else if (event.key === "ArrowRight") go(next);
      else if (key === "t") go(today, linkView);
      else if (key === "w") go(anchor, "week");
      else if (key === "m") go(anchor, "month");
      else if (key === "d") go(anchor, "day");
      else if (key === "l") go(anchor, "list");
      else if (key === "g") go(anchor, "grid");
      else if (key === "j" || key === "k") {
        const nodes = [...document.querySelectorAll<HTMLElement>("[data-plan-card]")].filter(
          (node) => node.offsetParent !== null,
        );
        if (!nodes.length) return;
        const index = nodes.findIndex((node) => node === document.activeElement);
        const step = key === "j" ? 1 : -1;
        const nextIndex = index < 0 ? 0 : (index + step + nodes.length) % nodes.length;
        event.preventDefault();
        nodes[nextIndex]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, go, linkView, next, prev, slot, today]);

  const onDragStart = () => {
    dragged.current = true;
  };

  const body = (which: PlanView) => {
    if (which === "month")
      return (
        <MonthGrid
          days={days}
          cards={shown}
          slots={slots}
          events={events}
          pillars={pillars}
          hrefFor={dayHref}
        />
      );
    if (which === "day")
      return (
        <DayBoard
          day={days[0]}
          cards={shown}
          slots={slots}
          hrefFor={hrefFor}
          onSlot={setSlot}
        />
      );
    if (which === "list")
      return (
        <Agenda
          days={days}
          cards={shown}
          slots={slots}
          hrefFor={hrefFor}
          onSlot={setSlot}
        />
      );
    if (which === "grid")
      return <FeedGrid cards={tiles} hrefFor={hrefFor} />;
    return (
      <WeekGrid
        days={days}
        hours={hours}
        cards={shown}
        slots={slots}
        pillars={pillars}
        hrefFor={hrefFor}
        nowMinutes={nowMinutes}
        overKey={overKey}
        onDragStart={onDragStart}
        onDragEnd={() => {
          window.setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
        onOver={setOverKey}
        onDropHour={dropHour}
        onDropSlot={(id, at) => moveTo(id, at)}
        onSlot={setSlot}
      />
    );
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${busy ? "opacity-70" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="mr-auto min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{health}. {QUEUE_ZONE_LABEL} time.</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{bestTime}</p>
        </div>
        <nav aria-label="Change period" className="flex items-center gap-1">
          <Link
            href={planHref(projectId, today, prev, linkView)}
            aria-label="Previous"
            className="grid size-11 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href={planHref(projectId, today, today, linkView)}
            className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Today
          </Link>
          <Link
            href={planHref(projectId, today, next, linkView)}
            aria-label="Next"
            className="grid size-11 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </nav>
        <div role="tablist" aria-label="Plan view" className="flex rounded-lg border border-border p-0.5">
          {VIEWS.map((item) => {
            const selected = responsive
              ? item.id === "list" || item.id === "week"
                ? item.id === "list"
                  ? "max-md:border-link max-md:text-link md:border-transparent md:text-muted-foreground"
                  : "border-transparent text-muted-foreground md:border-link md:text-link"
                : "border-transparent text-muted-foreground"
              : view === item.id
                ? "border-link text-link"
                : "border-transparent text-muted-foreground";
            return (
              <Link
                key={item.id}
                href={planHref(projectId, today, anchor, item.id)}
                role="tab"
                aria-selected={responsive ? undefined : view === item.id}
                className={`flex min-h-11 items-center border-b-2 px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <ApproveWeek projectId={projectId} ready={ready} notReady={[]} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Filter
          label="Status"
          value={filter.status}
          onChange={(status) => setFilter({ ...filter, status })}
          options={[
            ["all", "All"],
            ["review", "Needs your OK"],
            ["scheduled", "Scheduled"],
            ["posted", "Posted"],
            ["failed", "Failed"],
            ["claude", "With Claude"],
          ]}
        />
        <Filter
          label="Channel"
          value={filter.channel}
          onChange={(channel) => setFilter({ ...filter, channel })}
          options={[
            ["all", "All"],
            ["instagram", "Instagram"],
            ["facebook", "Facebook"],
            ["tiktok", "TikTok"],
          ]}
        />
        <Filter
          label="Format"
          value={filter.format}
          onChange={(format) => setFilter({ ...filter, format })}
          options={[
            ["all", "All"],
            ["reel", "Reel"],
            ["carousel", "Carousel"],
            ["photo", "Photo"],
          ]}
        />
        <Filter
          label="Pillar"
          value={filter.pillar}
          onChange={(pillar) => setFilter({ ...filter, pillar })}
          options={[["all", "All"], ["none", "None"], ...pillars.map((pillar) => [pillar, pillar] as [string, string])]}
        />
        <input
          ref={searchRef}
          value={filter.q}
          onChange={(event) => setFilter({ ...filter, q: event.target.value })}
          placeholder="Search"
          aria-label="Search posts"
          className="min-h-11 w-36 rounded-lg border border-border bg-field px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        {(filter.status !== "all" ||
          filter.channel !== "all" ||
          filter.format !== "all" ||
          filter.pillar !== "all" ||
          filter.q) && (
          <button
            type="button"
            onClick={() => setFilter(EMPTY_FILTER)}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {events.map((event) => {
          const when = days.find((day) => day.key === event.date)?.date ?? event.date;
          const className = "shrink-0 rounded-full border border-border px-2 py-1 text-xs";
          return event.url ? (
            <a key={`${event.date}-${event.title}`} href={event.url} className={className}>
              {when} {event.title}
            </a>
          ) : (
            <span key={`${event.date}-${event.title}`} className={className}>
              {when} {event.title}
            </span>
          );
        })}
        <EventForm
          projectId={projectId}
          onAdd={(date, name) => {
            start(async () => {
              try {
                await addPlanEvent(projectId, date, name);
                toast.success("Event added");
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add it");
              }
            });
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-64 shrink-0 flex-col overflow-auto rounded-xl border border-border bg-card p-3 md:flex">
          <Tray
            cards={shownTray}
            hrefFor={hrefFor}
            nextTime={nextTime}
            readyIdeas={readyIdeas}
            ideasHref={ideasHref}
            onDragStart={onDragStart}
            onGive={(id, at) => moveTo(id, at)}
          />
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          {responsive ? (
            <>
              <div className="md:hidden">{body("list")}</div>
              <div className="hidden md:block">{body("week")}</div>
            </>
          ) : (
            body(view)
          )}
        </div>
      </div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="flex min-h-11 w-full items-center justify-between rounded-lg border border-border px-3 text-sm"
        >
          Needs a time ({shownTray.length})
        </button>
      </div>

      {trayOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-auto rounded-t-xl border border-border bg-background p-4 md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Needs a time</h3>
            <button type="button" onClick={() => setTrayOpen(false)} className="min-h-11 px-2 text-sm">
              Close
            </button>
          </div>
          <Tray
            cards={shownTray}
            hrefFor={hrefFor}
            nextTime={nextTime}
            readyIdeas={readyIdeas}
            ideasHref={ideasHref}
            onDragStart={onDragStart}
            onGive={(id, at) => moveTo(id, at)}
          />
        </div>
      )}

      {slot && (
        <div
          role="dialog"
          aria-label={`${slot.label} at ${slot.time}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
        >
          <div className="max-h-[80dvh] w-full max-w-md overflow-auto rounded-t-xl border border-border bg-background p-4 md:rounded-xl">
            <h3 className="text-sm font-medium">
              {slot.label} · {slot.time}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a post that needs a time, or start a new one here.
            </p>
            <ul className="mt-3 space-y-2">
              {shownTray.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => moveTo(card.id, slot.at)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border px-2 text-left text-sm hover:bg-muted"
                  >
                    <Thumb card={card} />
                    <span className="min-w-0 flex-1 truncate">{card.label}</span>
                  </button>
                </li>
              ))}
              {!shownTray.length && (
                <li className="text-sm text-muted-foreground">
                  Nothing is waiting for a time. Start a post below.
                </li>
              )}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  start(async () => {
                    try {
                      const id = await startPlanPost(projectId, slot.at, slot.label);
                      setSlot(null);
                      router.push(planHref(projectId, today, anchor, linkView, id));
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not start it");
                    }
                  });
                }}
                className="min-h-11 flex-1 rounded-lg bg-foreground px-3 text-sm text-background"
              >
                Start a post at {slot.time}
              </button>
              <button
                type="button"
                onClick={() => setSlot(null)}
                className="min-h-11 rounded-lg px-3 text-sm hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex min-h-10 items-center gap-1 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tray({
  cards,
  hrefFor,
  nextTime,
  readyIdeas,
  ideasHref,
  onDragStart,
  onGive,
}: {
  cards: PlanCard[];
  hrefFor: (id: string) => string;
  nextTime: Record<string, number>;
  readyIdeas: number;
  ideasHref: string;
  onDragStart: (id: string) => void;
  onGive: (id: string, at: number) => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-medium text-muted-foreground">Needs a time ({cards.length})</h3>
        <ul className="mt-2 space-y-2">
          {cards.map((card) => (
            <li key={card.id} className="space-y-1">
              <Link
                href={hrefFor(card.id)}
                scroll={false}
                draggable={card.movable}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", card.id);
                  event.dataTransfer.effectAllowed = "move";
                  onDragStart(card.id);
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border p-1.5 hover:bg-muted"
              >
                <Thumb card={card} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-medium leading-tight">{card.label}</span>
                  <span className="mt-0.5 block"><StatusChip word={card.word} /></span>
                  <Channels channels={card.channels} />
                </span>
              </Link>
              {nextTime[card.id] != null && (
                <button
                  type="button"
                  onClick={() => onGive(card.id, nextTime[card.id])}
                  className="min-h-11 w-full rounded-lg px-2 text-left text-xs text-link underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Give it {formatDayTime(nextTime[card.id])}
                </button>
              )}
            </li>
          ))}
          {!cards.length && (
            <li className="text-xs text-muted-foreground">
              Every post in review has a time. New drafts land here until you give them one.
            </li>
          )}
        </ul>
      </section>
      <section>
        <h3 className="text-xs font-medium text-muted-foreground">Ideas ready ({readyIdeas})</h3>
        <Link
          href={readyIdeas ? ideasHref : `${ideasHref}/new`}
          className="mt-1 inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {readyIdeas ? "Open Ideas" : "Add an idea"}
        </Link>
      </section>
    </div>
  );
}

function EventForm({
  onAdd,
}: {
  projectId: string;
  onAdd: (date: string, title: string) => void;
}) {
  return (
    <form
      className="ml-auto flex shrink-0 items-center gap-1"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const date = String(data.get("date") ?? "");
        const title = String(data.get("title") ?? "");
        if (!date || !title.trim()) return;
        onAdd(date, title);
        event.currentTarget.reset();
      }}
    >
      <input
        type="date"
        name="date"
        required
        aria-label="Event date"
        className="min-h-10 rounded-lg border border-border bg-field px-2 text-xs"
      />
      <input
        name="title"
        required
        maxLength={80}
        placeholder="Event"
        aria-label="Event name"
        className="min-h-10 w-28 rounded-lg border border-border bg-field px-2 text-xs"
      />
      <button type="submit" className="min-h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:brightness-110">
        Add
      </button>
    </form>
  );
}
