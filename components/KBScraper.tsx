"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function KBScraper({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleScrape = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Enter a URL first");
      return;
    }
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/kb/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      setDone(true);
      toast.success("Knowledge base populated from website!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to scrape URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 p-3 rounded-lg border border-border bg-muted">
      <Globe className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
      <Input
        placeholder="https://yourwebsite.com — auto-fill KB from your site"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setDone(false); }}
        onKeyDown={(e) => e.key === "Enter" && handleScrape()}
        className="h-9 bg-transparent border-none shadow-none focus-visible:ring-0 px-1"
        disabled={loading}
      />
      <Button
        size="sm"
        variant={done ? "outline" : "default"}
        onClick={handleScrape}
        disabled={loading || !url.trim()}
        className="shrink-0"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        ) : (
          "Import"
        )}
      </Button>
    </div>
  );
}
