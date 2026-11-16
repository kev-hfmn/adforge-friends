"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateAction } from "@/app/projects/[id]/generate/actions";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
  brandColor: string | null;
};

export function QuickGenerateForm({ projects }: { projects: Project[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects[0]?.id ?? "",
  );
  const [templateType, setTemplateType] = useState<"ad" | "reel">("ad");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{
    headlineStart: string;
    headlineHighlight: string;
    subtext: string;
    boldPhrases: string[];
    backgroundPreset: string;
    stats: { label: string; value: string; change?: string }[];
    socialProof: string;
    ctaText: string;
  } | null>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const prevPreviewUrlRef = useRef<string | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const brandColor = selectedProject?.brandColor ?? "#6366f1";

  const currentPreview = result ?? {
    headlineStart: "Your headline",
    headlineHighlight: "goes here",
    subtext: "Generate content using the form to see a live preview.",
    boldPhrases: [],
    backgroundPreset: "dark-gradient",
    stats: [],
    socialProof: "",
    ctaText: "Get Started",
  };

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          templateType,
          layoutStyle: "bold-statement",
          backgroundPreset: currentPreview.backgroundPreset,
          brandColor,
          headlineStart: currentPreview.headlineStart,
          headlineHighlight: currentPreview.headlineHighlight,
          subtext: currentPreview.subtext,
          boldPhrases: currentPreview.boldPhrases,
          stats: currentPreview.stats,
          socialProof: currentPreview.socialProof,
          ctaText: currentPreview.ctaText,
        }),
      });
      if (!res.ok) throw new Error("Render failed");
      const blob = await res.blob();
      if (prevPreviewUrlRef.current)
        URL.revokeObjectURL(prevPreviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevPreviewUrlRef.current = url;
      setPreviewUrl(url);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType, brandColor, result]);

  useEffect(() => {
    // Preserve the existing local preview refresh when the selected format changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType, selectedProjectId]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    if (!selectedProjectId) {
      toast.error("Select a project first");
      return;
    }
    startTransition(async () => {
      const res = await generateAction(selectedProjectId, prompt, templateType);
      if (res.success && res.data) {
        setResult({
          headlineStart: res.data.headlineStart,
          headlineHighlight: res.data.headlineHighlight,
          subtext: res.data.subtext,
          boldPhrases: res.data.boldPhrases,
          backgroundPreset: res.data.backgroundPreset ?? "dark-gradient",
          stats: res.data.stats ?? [],
          socialProof: res.data.socialProof,
          ctaText: res.data.ctaText,
        });
        toast.success("Generated! Saved to project queue.");
        refreshPreview();
      } else {
        toast.error(res.error ?? "Generation failed");
      }
    });
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* Controls */}
      <div className="min-w-0 space-y-6 border-b border-border px-4 py-6 md:border-b-0 md:border-r md:px-8 md:py-8">
        <div className="space-y-2">
          <Label htmlFor="project-select">Project</Label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Template type</Label>
          <Tabs
            value={templateType}
            onValueChange={(v) => setTemplateType(v as "ad" | "reel")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="ad" className="flex-1">
                Feed post
              </TabsTrigger>
              <TabsTrigger value="reel" className="flex-1">
                Reel
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-prompt">Prompt</Label>
          <Textarea
            id="quick-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the ad you want to create..."
            rows={5}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {result && (
          <a
            href={`/projects/${selectedProjectId}/queue`}
            className="block text-center flex min-h-10 items-center justify-center text-sm text-muted-foreground underline underline-offset-4"
          >
            View in project queue →
          </a>
        )}
      </div>

      {/* Preview */}
      <div className="flex min-w-0 flex-col items-center justify-center gap-4 px-4 py-6 md:px-8 md:py-8">
        <div
          className="relative w-full max-w-sm"
          style={{ aspectRatio: templateType === "reel" ? "9/16" : "1/1" }}
        >
          {previewUrl && (
            // The preview is an existing local object URL, rendered at its original ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Post preview"
              className={`w-full h-full object-contain rounded-lg transition-opacity ${previewLoading ? "opacity-30" : "opacity-100"}`}
            />
          )}
          {previewLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {previewError && !previewLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Preview unavailable. Try refreshing.
              </p>
              <Button variant="outline" size="sm" onClick={refreshPreview}>
                Retry preview
              </Button>
            </div>
          )}
          {!previewUrl && !previewLoading && !previewError && (
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Preview will appear here
              </p>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          onClick={refreshPreview}
          disabled={previewLoading}
          className="w-full max-w-sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh preview
        </Button>
      </div>
    </div>
  );
}
