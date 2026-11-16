"use client";

import { useEffect, useState } from "react";

// Thumbnail row of everything already uploaded for this project. Upload a
// screenshot once, reuse it on every slide and every future post.
export function ScreenshotStrip({
  projectId,
  selected,
  onPick,
  refreshKey = 0,
}: {
  projectId: string;
  selected?: string | null;
  onPick: (path: string) => void;
  /** bump to re-fetch after a new upload */
  refreshKey?: number;
}) {
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/uploads?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPaths(d.paths ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  if (!paths.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {paths.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          title={p.split("/").pop()}
          className={`flex-none w-12 h-12 rounded-lg border-2 overflow-hidden transition-all ${
            selected === p ? "border-primary scale-105" : "border-border hover:border-primary/60"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}
