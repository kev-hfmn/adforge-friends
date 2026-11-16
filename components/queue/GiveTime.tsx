"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { schedulePost } from "@/app/projects/[id]/queue/actions";

/** One tap: give an approved post the offered time. Scheduling only, never publishing. */
export function GiveTime({
  postId,
  projectId,
  at,
  label,
}: {
  postId: string;
  projectId: string;
  at: number;
  label: string;
}) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      className="min-h-11"
      disabled={busy}
      onClick={() =>
        start(async () => {
          try {
            await schedulePost(postId, projectId, at);
            toast.success(`Scheduled for ${label}`);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not schedule");
          }
        })
      }
    >
      Give it {label}
    </Button>
  );
}
