"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { refreshQueueStats } from "@/app/projects/[id]/queue/actions";
export function RefreshStats({
  projectId,
  connected,
}: {
  projectId: string;
  connected: boolean;
}) {
  const [busy, start] = useTransition(),
    router = useRouter();
  return (
    <div className="text-right">
      <Button
        variant="outline"
        className="min-h-11"
        disabled={busy || !connected}
        onClick={() =>
          start(async () => {
            try {
              const result = await refreshQueueStats(projectId);
              toast.message(result.message);
              router.refresh();
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Stats refresh failed",
              );
            }
          })
        }
      >
        <RefreshCw className={busy ? "animate-spin" : ""} />
        {busy ? "Refreshing stats" : "Refresh stats"}
      </Button>
      {!connected && (
        <p className="mt-2 text-xs text-muted-foreground">
          Reconnect to refresh.
        </p>
      )}
    </div>
  );
}
