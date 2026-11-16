"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bulkGenerate } from "@/app/projects/[id]/generate/bulk-action";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function BulkGenerateDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(5);
  const [prompt, setPrompt] = useState("");
  const [templateType, setTemplateType] = useState<"ad" | "reel">("ad");
  const [progress, setProgress] = useState(0);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt");
      return;
    }
    setProgress(0);
    startTransition(async () => {
      const result = await bulkGenerate(projectId, prompt, templateType, count);
      if (result.success) {
        toast.success(`Generated ${result.count} posts!`);
        setOpen(false);
        setProgress(0);
      } else {
        toast.error(result.error || "Bulk generation failed");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Layers className="mr-2 h-4 w-4" />
          Bulk Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Generate</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Template Type</Label>
            <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "ad" | "reel")}>
              <TabsList className="w-full">
                <TabsTrigger value="ad" className="flex-1">Ad (1080x1080)</TabsTrigger>
                <TabsTrigger value="reel" className="flex-1">Reel (1080x1920)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>Number of posts: {count}</Label>
            <Slider
              value={[count]}
              onValueChange={(val) => setCount(Array.isArray(val) ? val[0] : val)}
              min={2}
              max={20}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Base Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the content theme... AI will create variations."
              rows={4}
            />
          </div>

          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Layers className="mr-2 h-4 w-4" />
                Generate {count} Posts
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
