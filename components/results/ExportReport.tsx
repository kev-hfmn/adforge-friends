"use client";

import { useState, useTransition } from "react";
import { exportWeekReport } from "@/app/projects/[id]/results/actions";

export function ExportReport({ projectId, week }: { projectId: string; week: string }) {
  const [sentence, setSentence] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const saved = await exportWeekReport(projectId, week, sentence);
            setNote(`Wrote ${saved.file}`);
          } catch (error) {
            setNote(error instanceof Error ? error.message : "Export failed");
          }
        });
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>One sentence on what changes next</span>
        <textarea
          value={sentence}
          onChange={(event) => setSentence(event.target.value)}
          rows={3}
          placeholder="What changes next week."
          className="w-full rounded-lg border border-border bg-field px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {busy ? "Exporting" : "Export markdown"}
      </button>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </form>
  );
}
