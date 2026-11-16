"use client";

import Link from "next/link";
import { Channels, FormatIcon, StatusChip, Thumb, cardLabel } from "@/components/plan/bits";
import {
  firstOpenHour,
  formatLabel,
  pillarTint,
  type PlanCard,
  type PlanDay,
  type PlanSlot,
} from "@/lib/plan";

export function WeekGrid({
  days,
  hours,
  cards,
  slots,
  pillars,
  hrefFor,
  nowMinutes,
  overKey,
  onDragStart,
  onDragEnd,
  onOver,
  onDropHour,
  onDropSlot,
  onSlot,
}: {
  days: PlanDay[];
  hours: number[];
  cards: PlanCard[];
  slots: PlanSlot[];
  pillars: string[];
  hrefFor: (id: string) => string;
  nowMinutes: number | null;
  overKey: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOver: (key: string | null) => void;
  onDropHour: (id: string, day: string, hour: number, offsetY: number, height: number) => void;
  onDropSlot: (id: string, at: number) => void;
  onSlot: (slot: PlanSlot) => void;
}) {
  const nowHour = nowMinutes == null ? null : Math.floor(nowMinutes / 60);
  return (
    <div
      className="grid min-w-[760px]"
      style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}
    >
      <div className="sticky top-0 z-10 bg-background" />
      {days.map((day) => (
        <div
          key={day.key}
          className={`sticky top-0 z-10 border-b border-border bg-background px-1 py-2 text-xs ${
            day.today ? "font-semibold text-[var(--queue-accent)]" : "font-medium"
          }`}
        >
          <span className="block">{day.name}</span>
          <span className="text-muted-foreground">{day.date}</span>
          {day.today && <span className="block text-xs">Today</span>}
        </div>
      ))}
      {hours.map((hour) => (
        <HourRow
          key={hour}
          hour={hour}
          days={days}
          cards={cards}
          slots={slots}
          pillars={pillars}
          hrefFor={hrefFor}
          nowHour={nowHour}
          overKey={overKey}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onOver={onOver}
          onDropHour={onDropHour}
          onDropSlot={onDropSlot}
          onSlot={onSlot}
        />
      ))}
    </div>
  );
}

function HourRow({
  hour,
  days,
  cards,
  slots,
  pillars,
  hrefFor,
  nowHour,
  overKey,
  onDragStart,
  onDragEnd,
  onOver,
  onDropHour,
  onDropSlot,
  onSlot,
}: {
  hour: number;
  days: PlanDay[];
  cards: PlanCard[];
  slots: PlanSlot[];
  pillars: string[];
  hrefFor: (id: string) => string;
  nowHour: number | null;
  overKey: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOver: (key: string | null) => void;
  onDropHour: (id: string, day: string, hour: number, offsetY: number, height: number) => void;
  onDropSlot: (id: string, at: number) => void;
  onSlot: (slot: PlanSlot) => void;
}) {
  const label = `${String(hour).padStart(2, "0")}:00`;
  return (
    <>
      <div
        className={`border-b border-border py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground ${
          nowHour === hour ? "font-medium text-red-500" : ""
        }`}
      >
        {label}
      </div>
      {days.map((day) => {
        const key = `${day.key}:${hour}`;
        const mine = cards.filter(
          (card) => card.day === day.key && Math.floor((card.minutes ?? 0) / 60) === hour,
        );
        const open = slots.filter((slot) => slot.day === day.key && slot.hour === hour);
        return (
          <div
            key={key}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (overKey !== key) onOver(key);
            }}
            onDragLeave={() => onOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              onDropHour(
                event.dataTransfer.getData("text/plain"),
                day.key,
                hour,
                event.clientY - rect.top,
                rect.height,
              );
            }}
            className={`relative min-h-16 space-y-1 border-b border-l border-border p-1 ${
              overKey === key ? "bg-[var(--queue-accent)]/10" : ""
            } ${day.past ? "opacity-70" : ""}`}
          >
            {day.today && nowHour === hour && (
              <span className="absolute inset-x-0 top-0 z-10 h-0.5 bg-red-500" aria-hidden />
            )}
            {mine.map((card) => (
              <WeekCard
                key={card.id}
                card={card}
                pillars={pillars}
                href={hrefFor(card.id)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
            {open.map((slot) => (
              <button
                key={`${slot.day}-${slot.time}-${slot.label}`}
                type="button"
                onClick={() => onSlot(slot)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDropSlot(event.dataTransfer.getData("text/plain"), slot.at);
                }}
                aria-label={`Add a post for ${slot.label} at ${slot.time}`}
                className="flex min-h-11 w-full flex-col justify-center rounded-md border border-dashed border-border px-1.5 py-1 text-left text-xs leading-tight text-muted-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="block truncate">{slot.label}</span>
                <span className="tabular-nums">{slot.time}</span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

function WeekCard({
  card,
  pillars,
  href,
  onDragStart,
  onDragEnd,
}: {
  card: PlanCard;
  pillars: string[];
  href: string;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const tint = card.pillar ? pillarTint(card.pillar, pillars) : undefined;
  return (
    <Link
      href={href}
      scroll={false}
      data-plan-card
      draggable={card.movable}
      aria-label={cardLabel(card)}
      title={card.label}
      onDragStart={(event) => {
        if (!card.movable) return;
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.dataset.dragged = "1";
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (!card.movable) return;
        const flag = (event.currentTarget as HTMLElement).dataset.dragged;
        if (flag === "1") {
          event.preventDefault();
          delete (event.currentTarget as HTMLElement).dataset.dragged;
        }
      }}
      className={`flex items-start gap-1.5 rounded-md border border-border bg-card p-1.5 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring ${
        card.movable ? "cursor-grab" : ""
      }`}
      style={
        tint
          ? { boxShadow: `inset 2px 0 0 ${tint}, inset 0 1px 0 oklch(1 0 0 / 16%), 0 1px 2px oklch(0 0 0 / 35%)` }
          : undefined
      }
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground min-[1600px]:hidden">
        <FormatIcon format={card.format} />
      </span>
      <Thumb card={card} className="hidden w-8 min-[1600px]:block" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 w-full text-xs font-medium leading-tight">{card.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          {card.time ? <span className="text-xs tabular-nums leading-tight text-muted-foreground">{card.time}</span> : null}
          <StatusChip word={card.word} />
        </span>
        <Channels channels={card.channels} />
        {card.reach != null && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">
            {card.reach} reach{card.sends != null ? ` · ${card.sends} sends` : ""}
          </span>
        )}
      </span>
    </Link>
  );
}

export function Agenda({
  days,
  cards,
  slots,
  hrefFor,
  onSlot,
}: {
  days: PlanDay[];
  cards: PlanCard[];
  slots: PlanSlot[];
  hrefFor: (id: string) => string;
  onSlot: (slot: PlanSlot) => void;
}) {
  return (
    <div>
      {days.map((day) => {
        const mine = cards.filter((card) => card.day === day.key);
        const slot = firstOpenHour(slots, day.key);
        return (
          <section key={day.key} aria-label={`${day.name} ${day.date}`}>
            <h3
              className={`sticky top-0 z-10 border-b border-border bg-background px-1 py-2 text-xs font-medium ${
                day.today ? "text-[var(--queue-accent)]" : ""
              }`}
            >
              {day.name} {day.date}
              {day.today ? " · today" : ""}
            </h3>
            {mine.map((card) => (
              <Link
                key={card.id}
                href={hrefFor(card.id)}
                scroll={false}
                data-plan-card
                aria-label={cardLabel(card)}
                className="flex min-h-14 items-center gap-3 border-b border-border px-1 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Thumb card={card} className="w-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">{card.time}</span>
                    <StatusChip word={card.word} />
                  </span>
                  <span className="block truncate text-sm">{card.label}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatLabel(card.format, card.slides)}
                    </span>
                    <Channels channels={card.channels} />
                  </span>
                </span>
              </Link>
            ))}
            {!mine.length && (
              <p className="flex min-h-14 flex-wrap items-center gap-3 px-1 text-sm text-muted-foreground">
                <span>{day.past ? "Nothing went out." : "Nothing planned."}</span>
                {slot ? (
                  <button
                    type="button"
                    onClick={() => onSlot(slot)}
                    className="min-h-11 rounded-lg border border-dashed border-border px-3 text-xs text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Add for {slot.time}
                  </button>
                ) : !day.past ? (
                  <span>Place one from Needs a time.</span>
                ) : null}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function MonthGrid({
  days,
  cards,
  slots,
  events,
  pillars,
  hrefFor,
}: {
  days: PlanDay[];
  cards: PlanCard[];
  slots: PlanSlot[];
  events: { date: string }[];
  pillars: string[];
  hrefFor: (day: string) => string;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <div key={name} className="px-1 py-1">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-l border-border">
        {days.map((day) => {
          const mine = cards.filter((card) => card.day === day.key);
          const extra = Math.max(0, mine.length - 3);
          const open = slots.filter((slot) => slot.day === day.key).length;
          const marked = events.some((event) => event.date === day.key);
          const tint = mine.find((card) => card.pillar)?.pillar;
          return (
            <Link
              key={day.key}
              href={hrefFor(day.key)}
              className={`min-h-24 border-b border-r border-border p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${
                day.inMonth ? "" : "opacity-40"
              } ${day.today ? "bg-[var(--queue-accent)]/10" : ""}`}
            >
              <span className="flex items-center justify-between text-xs">
                <span className={day.today ? "font-semibold text-[var(--queue-accent)]" : ""}>
                  {day.date.split(" ")[0]}
                </span>
                {marked ? (
                  <span className="inline-flex items-center">
                    <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                    <span className="sr-only">Event on this day</span>
                  </span>
                ) : null}
              </span>
              {tint && (
                <span
                  className="mt-1 block h-0.5"
                  style={{ background: pillarTint(tint, pillars) }}
                />
              )}
              <span className="mt-1 flex gap-0.5">
                {mine.slice(0, 3).map((card) => (
                  <Thumb key={card.id} card={card} className="w-5" />
                ))}
              </span>
              {extra > 0 && <span className="mt-1 block text-xs text-muted-foreground">+{extra}</span>}
              {open > 0 && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {open} open
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DayBoard({
  day,
  cards,
  slots,
  hrefFor,
  onSlot,
}: {
  day: PlanDay | undefined;
  cards: PlanCard[];
  slots: PlanSlot[];
  hrefFor: (id: string) => string;
  onSlot: (slot: PlanSlot) => void;
}) {
  if (!day) return null;
  const slot = firstOpenHour(slots, day.key);
  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <Link
          key={card.id}
          href={hrefFor(card.id)}
          scroll={false}
          data-plan-card
          aria-label={cardLabel(card)}
          className="flex gap-3 rounded-xl border border-border p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Thumb card={card} className="w-24" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium tabular-nums">{card.time}</span>
              <span className="text-xs text-muted-foreground">
                {formatLabel(card.format, card.slides)}
              </span>
              <StatusChip word={card.word} />
            </span>
            <span className="block text-sm">{card.label}</span>
            {card.caption && (
              <span className="line-clamp-3 block text-xs leading-relaxed text-muted-foreground">
                {card.caption}
              </span>
            )}
            <Channels channels={card.channels} words />
            {card.notes > 0 && (
              <span className="block text-xs text-muted-foreground">
                {card.notes} {card.notes === 1 ? "note" : "notes"}
              </span>
            )}
            {card.reach != null && (
              <span className="block text-xs tabular-nums text-muted-foreground">
                {card.reach} reach{card.sends != null ? `, ${card.sends} sends` : ""}
              </span>
            )}
          </span>
        </Link>
      ))}
      {!cards.length && (
        <p className="flex min-h-14 flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{day.past ? "Nothing went out." : "Nothing planned."}</span>
          {slot ? (
            <button
              type="button"
              onClick={() => onSlot(slot)}
              className="min-h-11 rounded-lg border border-dashed border-border px-3 text-xs text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Add for {slot.time}
            </button>
          ) : !day.past ? (
            <span>Place one from Needs a time.</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

export function FeedGrid({
  cards,
  hrefFor,
}: {
  cards: PlanCard[];
  hrefFor: (id: string) => string;
}) {
  if (!cards.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nothing with a picture yet. Open a post and add one.
      </p>
    );
  return (
    <div className="space-y-3">
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-1">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={hrefFor(card.id)}
            scroll={false}
            data-plan-card
            aria-label={cardLabel(card)}
            className="relative block overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            style={{ aspectRatio: "4 / 5" }}
          >
            <Thumb card={card} cover className="h-full w-full" />
            {card.statusKey !== "posted" && card.time && (
              <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-xs tabular-nums">
                {card.time}
              </span>
            )}
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Instagram crops these. Scheduled posts sit ahead of posted ones. Facebook-only posts stay off this grid.
      </p>
    </div>
  );
}
