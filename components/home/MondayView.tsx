import type { ReactNode } from "react";
import Link from "next/link";
import { MondayMore } from "./MondayMore";

const heading = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function MondayView({
  planHref,
  resultsHref,
  ideasHref,
  hubHref,
  days,
  cards,
  slots,
  lines,
  takeaway,
  readyIdeas,
  tasteDrafts,
  children,
}: {
  planHref: string;
  resultsHref: string;
  ideasHref: string;
  hubHref: string;
  days: { key: string; name: string; date: string; today: boolean }[];
  cards: { id: string; day: string | null; time: string | null; label: string }[];
  slots: { day: string }[];
  lines: { text: string; tooFew?: boolean }[];
  takeaway: { text: string; numbers: string } | null;
  readyIdeas: number;
  tasteDrafts: number;
  children: ReactNode;
}) {
  const open = slots.length;
  return (
    <MondayMore>
      <section className="space-y-3" aria-labelledby="home-week">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="home-week" className={heading}>
            This week
          </h2>
          <Link
            href={planHref}
            className="inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Open Plan
          </Link>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {open === 1 ? "1 open slot" : `${open} open slots`}
        </p>
        <ol className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayCards = cards.filter((card) => card.day === day.key);
            const daySlots = slots.filter((slot) => slot.day === day.key).length;
            return (
              <li key={day.key}>
                <Link
                  href={`${planHref}?w=${day.key}`}
                  className={`flex min-h-24 flex-col gap-1 rounded-lg border px-1.5 py-2 text-[12px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${day.today ? "border-[var(--queue-accent)]" : "border-border"}`}
                >
                  <span className="font-medium">{day.name}</span>
                  <span className="tabular-nums text-muted-foreground">{day.date}</span>
                  {dayCards.slice(0, 2).map((card) => (
                    <span key={card.id} className="truncate tabular-nums">
                      {card.time} {card.label}
                    </span>
                  ))}
                  <span className="mt-auto tabular-nums text-muted-foreground">
                    {daySlots === 1 ? "1 open" : `${daySlots} open`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="space-y-3" aria-labelledby="home-numbers">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-numbers" className={heading}>
              Since last week
            </h2>
            <Link
              href={resultsHref}
              className="inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open Results
            </Link>
          </div>
          {lines.length ? (
            <>
              <ul className="space-y-1 text-sm tabular-nums">
                {lines.map((line) => (
                  <li key={line.text}>{line.text}</li>
                ))}
              </ul>
              {lines.some((line) => line.tooFew) ? (
                <p className="text-sm text-muted-foreground">Too few to compare as a percentage.</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No stored numbers yet. Save the stored reading on Results.
            </p>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="home-takeaway">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-takeaway" className={heading}>
              Top takeaway
            </h2>
            <Link
              href={`${resultsHref}#takeaways`}
              className="inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open Results
            </Link>
          </div>
          {takeaway ? (
            <div className="space-y-1">
              <p className="text-sm">{takeaway.text}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{takeaway.numbers}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No takeaway yet. It shows up after a few posts have numbers.
            </p>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="home-ideas">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="home-ideas" className={heading}>
                Ideas ready
              </h2>
              <Link
                href={readyIdeas ? ideasHref : `${ideasHref}/new`}
                className="inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {readyIdeas ? "Open Ideas" : "Add an idea"}
              </Link>
            </div>
            <p className="text-[28px] font-medium tabular-nums leading-none">{readyIdeas}</p>
          </div>
          <div className="space-y-2">
            <h2 className={heading}>What I taught this week</h2>
            <p className="text-sm">
              {tasteDrafts === 1
                ? "1 taste draft to confirm."
                : tasteDrafts > 1
                  ? `${tasteDrafts} taste drafts to confirm.`
                  : "No taste drafts to confirm."}
            </p>
            <Link
              href={tasteDrafts ? `${hubHref}?status=draft` : hubHref}
              className="inline-flex min-h-11 items-center text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open Hub
            </Link>
          </div>
        </section>
      </div>
      {children}
    </MondayMore>
  );
}
