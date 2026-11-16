"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Add a whole session of screenshots at once: pick the files, describe them once
 * (what feature, which tags, which day), and every file gets those labels.
 */
export function AssetUpload({
  projectId,
  kinds,
  today,
}: {
  projectId: string;
  kinds: { value: string; label: string }[];
  today: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!files.length) return;
    const shared = new FormData(e.currentTarget);
    let done = 0;
    const failed: string[] = [];
    for (const file of files) {
      setProgress(`Adding ${done + 1} of ${files.length}`);
      const body = new FormData();
      body.set("file", file);
      body.set("projectId", projectId);
      for (const key of ["kind", "feature", "tags", "capturedOn", "note"])
        body.set(key, String(shared.get(key) ?? ""));
      try {
        const response = await fetch("/api/assets", { method: "POST", body });
        if (!response.ok)
          throw new Error((await response.json()).error ?? "Upload failed");
        done++;
      } catch (error) {
        failed.push(
          `${file.name}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }
    setProgress(null);
    if (failed.length) toast.error(`Not added: ${failed.join("; ")}`);
    if (done) toast.success(`Added ${done} ${done === 1 ? "file" : "files"}`);
    setFiles([]);
    form.current?.reset();
    router.refresh();
  };
  return (
    <form
      ref={form}
      onSubmit={send}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="space-y-2">
        <Label htmlFor="asset-files">Add screenshots, photos, charts or clips</Label>
        <Input
          id="asset-files"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          className="min-h-11"
        />
        <p className="text-xs text-muted-foreground">
          Pick as many as you like. The labels below go on all of them; you can
          change one later.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="asset-kind" className="text-xs">
            Kind
          </Label>
          <select
            id="asset-kind"
            name="kind"
            defaultValue="screenshot"
            className="min-h-10 w-full rounded-lg border border-input bg-field px-2 text-sm"
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="asset-feature" className="text-xs">
            Feature or topic
          </Label>
          <Input id="asset-feature" name="feature" placeholder="Onboarding" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="asset-tags" className="text-xs">
            Tags, comma separated
          </Label>
          <Input id="asset-tags" name="tags" placeholder="dark mode, iphone" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="asset-day" className="text-xs">
            Captured on
          </Label>
          <Input
            id="asset-day"
            name="capturedOn"
            type="date"
            defaultValue={today}
          />
        </div>
      </div>
      <Button
        type="submit"
        className="min-h-11 w-full sm:w-auto"
        disabled={!files.length || progress != null}
      >
        <Upload />
        {progress ??
          (files.length
            ? `Add ${files.length} ${files.length === 1 ? "file" : "files"}`
            : "Choose files first")}
      </Button>
    </form>
  );
}
