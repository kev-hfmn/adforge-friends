"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStoredReading } from "@/app/projects/[id]/results/actions";

export function SaveStoredReading({ projectId }: { projectId: string }) {
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="max-w-xs text-left">
      <button
        type="button"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const saved = await saveStoredReading(projectId);
            setNote(
              saved.snapshots || saved.days
                ? `Saved ${saved.snapshots} readings and ${saved.days} follower days from numbers already stored.`
                : "Nothing new to store. Tokens are blank, so nothing was fetched.",
            );
            router.refresh();
          })
        }
      >
        {busy ? "Saving" : "Save stored reading"}
      </button>
      <p className="mt-2 max-w-xs text-xs text-muted-foreground">
        {note ?? "Tokens are blank on this copy. This stores numbers already on each post. It does not call Instagram."}
      </p>
    </div>
  );
}
