"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QueueImage } from "@/components/queue/Media";
import type { CurvePoint, ResultsRow } from "@/lib/results-assemble";

type SortKey = "date" | "format" | "pillar" | "reach" | "views" | "sends" | "saves" | "watch" | "skip" | "follows";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "format", label: "Format" },
  { key: "pillar", label: "Pillar" },
  { key: "reach", label: "Reach" },
  { key: "views", label: "Views" },
  { key: "sends", label: "Sends per reach" },
  { key: "saves", label: "Saves per reach" },
  { key: "watch", label: "Watch" },
  { key: "skip", label: "Skip" },
  { key: "follows", label: "Follows" },
];

function num(value: number | null): string {
  return value == null ? "n/a" : value.toLocaleString("en-GB");
}

export function ResultsBoard({
  rows,
  curves,
  brand,
  queueBase,
}: {
  rows: ResultsRow[];
  curves: { id: string; points: CurvePoint[] }[];
  brand: string;
  queueBase: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [format, setFormat] = useState("all");
  const [pillar, setPillar] = useState("all");
  const [hook, setHook] = useState("all");
  const [channel, setChannel] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const formats = useMemo(() => [...new Set(rows.map((row) => row.formatKey))].sort(), [rows]);
  const pillars = useMemo(() => [...new Set(rows.map((row) => row.pillar))].sort(), [rows]);
  const hooks = useMemo(() => [...new Set(rows.map((row) => row.hook))].sort(), [rows]);
  const shown = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (format !== "all" && row.formatKey !== format) return false;
      if (pillar !== "all" && row.pillar !== pillar) return false;
      if (hook !== "all" && row.hook !== hook) return false;
      if (channel !== "all" && !row.channels.includes(channel)) return false;
      return true;
    });
    const value = (row: ResultsRow): number | string | null => {
      if (sort.key === "date") return row.postedAt;
      if (sort.key === "format") return row.formatLabel;
      if (sort.key === "pillar") return row.pillar;
      if (sort.key === "reach") return row.reach;
      if (sort.key === "views") return row.views;
      if (sort.key === "sends") return row.sendsPerReach;
      if (sort.key === "saves") return row.savesPerReach;
      if (sort.key === "watch") return row.watchMs;
      if (sort.key === "skip") return row.skipRate;
      return row.follows;
    };
    return filtered.toSorted((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      const order = left < right ? -1 : left > right ? 1 : 0;
      return sort.dir === "asc" ? order : -order;
    });
  }, [rows, sort, format, pillar, hook, channel]);
  const curve = curves.find((item) => item.id === open);
  const maxReach = Math.max(1, ...(curve?.points.map((point) => point.reach ?? 0) ?? [1]));
  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Filter label="Format" value={format} onChange={setFormat} options={[["all", "All"], ...formats.map((item) => [item, item] as [string, string])]} />
        <Filter label="Pillar" value={pillar} onChange={setPillar} options={[["all", "All"], ...pillars.map((item) => [item, item] as [string, string])]} />
        <Filter label="Hook" value={hook} onChange={setHook} options={[["all", "All"], ...hooks.map((item) => [item, item] as [string, string])]} />
        <Filter
          label="Channel"
          value={channel}
          onChange={setChannel}
          options={[
            ["all", "All"],
            ["instagram", "Instagram"],
            ["facebook", "Facebook"],
            ["tiktok", "TikTok"],
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-[13px]">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-2 font-medium">Post</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="py-2 pr-2 font-medium" aria-sort={sort.key === column.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className="min-h-11 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => toggle(column.key)}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
              <th className="py-2 pr-2 font-medium">Facebook</th>
              <th className="py-2 font-medium">TikTok</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-border align-middle">
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-2">
                    <span className="block aspect-[4/5] w-9 shrink-0 overflow-hidden rounded-sm" style={{ background: brand }}>
                      <QueueImage src={row.imagePath} alt="" fit="contain" compact />
                    </span>
                    <span className="min-w-0">
                      <Link href={`${queueBase}${row.id}`} className="block max-w-48 truncate text-sm hover:underline">
                        {row.label}
                      </Link>
                      <button
                        type="button"
                        className="min-h-11 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        aria-expanded={open === row.id}
                        onClick={() => setOpen((current) => (current === row.id ? null : row.id))}
                      >
                        {open === row.id ? "Hide growth" : "Growth"}
                      </button>
                    </span>
                  </span>
                </td>
                <td className="py-2 pr-2 whitespace-nowrap tabular-nums">{row.dateLabel}</td>
                <td className="py-2 pr-2">{row.formatLabel}</td>
                <td className="py-2 pr-2">{row.pillar}</td>
                <td className="py-2 pr-2 tabular-nums">{num(row.reach)}</td>
                <td className="py-2 pr-2 tabular-nums">{num(row.views)}</td>
                <td className="py-2 pr-2 tabular-nums">{row.sendsLabel}</td>
                <td className="py-2 pr-2 tabular-nums">{row.savesLabel}</td>
                <td className="py-2 pr-2 tabular-nums">{row.watchLabel ?? "n/a"}</td>
                <td className="py-2 pr-2 tabular-nums">{row.skipRate == null ? "n/a" : row.skipRate}</td>
                <td className="py-2 pr-2 tabular-nums">{num(row.follows)}</td>
                <td className="py-2 pr-2 tabular-nums">{row.facebookReach == null ? "n/a" : row.facebookReach}</td>
                <td className="py-2 text-muted-foreground">Not available from Zernio</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length ? (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          No posts match these filters.
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => {
              setFormat("all");
              setPillar("all");
              setHook("all");
              setChannel("all");
            }}
          >
            Clear filters
          </button>
        </p>
      ) : null}
      {open && curve ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">Growth</h3>
          {curve.points.length ? (
            <ul className="space-y-2">
              {curve.points.map((point) => (
                <li key={point.takenAt} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-xs tabular-nums">
                  <span>{point.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-foreground/70"
                      style={{ width: `${Math.max(4, ((point.reach ?? 0) / maxReach) * 100)}%` }}
                    />
                  </span>
                  <span>
                    Reach {num(point.reach)}, views {num(point.views)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No snapshot yet. Save a stored reading to start the curve. It copies numbers already on the post.
            </p>
          )}
          {curve.points.length === 1 ? (
            <p className="text-xs text-muted-foreground">One reading so far.</p>
          ) : null}
        </div>
      ) : null}
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
    <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-field px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
