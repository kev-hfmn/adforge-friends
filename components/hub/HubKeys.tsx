"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** N opens a new hub entry, unless the keypress is in a field. */
export function HubKeys({ projectId }: { projectId: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]"))
        return;
      if (event.key.toLowerCase() !== "n") return;
      event.preventDefault();
      router.push(`/projects/${projectId}/hub?new=1`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projectId, router]);
  return null;
}
