"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { approveWeek } from "@/app/projects/[id]/queue/actions";

/**
 * Approve every waiting post that already has a proposed time, after showing the list.
 * Posts without a usable time are named and left where they are.
 */
export function ApproveWeek({
  projectId,
  ready,
  notReady,
}: {
  projectId: string;
  ready: { id: string; label: string; time: string }[];
  notReady: { label: string; reason: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const router = useRouter();
  if (!ready.length) return null;
  return (
    <>
      <Button
        className="min-h-10"
        onClick={() => setOpen(true)}
      >
        <CheckCheck />
        Approve all with a time ({ready.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>
            Approve {ready.length === 1 ? "this post" : `these ${ready.length} posts`}?
          </DialogTitle>
          <DialogDescription>
            Each one goes out on its own at the time shown. You can still
            change or decline any of them before then.
          </DialogDescription>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {ready.map((post) => (
              <li key={post.id} className="flex items-baseline gap-3">
                <span className="w-32 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {post.time}
                </span>
                <span className="min-w-0 flex-1">{post.label}</span>
              </li>
            ))}
          </ul>
          {notReady.length > 0 && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
              <p className="font-medium">
                Not included ({notReady.length}):
              </p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {notReady.map((post, i) => (
                  <li key={i}>
                    {post.label}: {post.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                start(async () => {
                  try {
                    const result = await approveWeek(
                      projectId,
                      ready.map((p) => p.id),
                    );
                    setOpen(false);
                    if (result.refused.length)
                      toast.error(
                        `Approved ${result.approved}. Not approved: ${result.refused
                          .map((r) => `${r.label} (${r.reason})`)
                          .join("; ")}`,
                      );
                    else toast.success(`Approved ${result.approved} posts`);
                    router.refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Could not approve",
                    );
                  }
                })
              }
            >
              Approve {ready.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
