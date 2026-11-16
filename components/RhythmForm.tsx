"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRhythm } from "@/app/projects/actions";

// `kind` is carried through untouched: it ties a slot to a post format where one exists.
type Row = { label: string; days: number[]; hour: number; kind?: string };
// Monday first, as in the Week view. Values are JS weekdays (0 = Sunday).
const DAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];

/** The project's usual week: what goes out on which days, at what hour. */
export function RhythmForm({
  projectId,
  initial,
  saved,
}: {
  projectId: string;
  initial: Row[];
  /** False while the project still runs on a built-in default that was never saved. */
  saved: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, start] = useTransition();
  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  return (
    <section className="space-y-4" aria-labelledby="rhythm-heading">
      <div>
        <h3 id="rhythm-heading" className="text-sm font-medium">
          Weekly rhythm
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The usual days and times. They are suggestions: a post gets the next
          free one when it needs a time, and empty days show them as a hint.
          Nothing is posted because of this list.
          {!saved && rows.length > 0 && " This is the built-in default; save to make it this project's own."}
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label="What goes out"
                placeholder="What goes out, e.g. Feature walkthrough"
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="min-w-0 flex-1"
              />
              <select
                aria-label="Hour"
                value={row.hour}
                onChange={(e) => update(i, { hour: Number(e.target.value) })}
                className="min-h-10 rounded-lg border border-input bg-field px-2 text-sm tabular-nums"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove this row"
                onClick={() => setRows((r) => r.filter((_, n) => n !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Days">
              {DAYS.map(([day, name]) => {
                const on = row.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      update(i, {
                        days: on
                          ? row.days.filter((d) => d !== day)
                          : [...row.days, day],
                      })
                    }
                    className={`min-h-10 min-w-11 rounded-lg border px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${on ? "border-[var(--project-accent)] bg-[var(--project-accent)]/15 text-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!rows.length && (
          <p className="text-sm text-muted-foreground">
            No rhythm yet. Without one, a post that needs a time is offered the
            next free day at 18:00.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-10"
          onClick={() =>
            setRows((r) => [...r, { label: "", days: [1, 3, 5], hour: 18 }])
          }
        >
          <Plus />
          Add a row
        </Button>
        <Button
          className="min-h-10"
          disabled={busy}
          onClick={() =>
            start(async () => {
              try {
                await saveRhythm(projectId, rows);
                toast.success("Rhythm saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save");
              }
            })
          }
        >
          Save rhythm
        </Button>
      </div>
    </section>
  );
}
