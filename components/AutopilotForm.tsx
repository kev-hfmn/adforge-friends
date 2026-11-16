"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { saveAutopilotConfig } from "@/app/projects/[id]/autopilot/actions";
import { toast } from "sonner";

interface Config {
  id: string;
  projectId: string | null;
  enabled: number | null;
  cronTime: string | null;
  promptTemplate: string | null;
  postsPerDay: number | null;
  autoPostAfterApproval: number | null;
  lastRunAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export function AutopilotForm({
  projectId,
  config,
}: {
  projectId: string;
  config: Config | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(config?.enabled === 1);
  const [cronTime, setCronTime] = useState(config?.cronTime || "0 8 * * *");
  const [promptTemplate, setPromptTemplate] = useState(
    config?.promptTemplate ||
      "Create an engaging Instagram ad for {{brand_name}} targeting {{target_audience}}. Make it attention-grabbing and include a strong call to action.",
  );
  const [postsPerDay, setPostsPerDay] = useState(config?.postsPerDay || 2);
  const [autoPost, setAutoPost] = useState(config?.autoPostAfterApproval === 1);

  const handleSave = () => {
    startTransition(async () => {
      await saveAutopilotConfig(projectId, {
        enabled,
        cronTime,
        promptTemplate,
        postsPerDay,
        autoPostAfterApproval: autoPost,
      });
      toast.success("Autopilot settings saved");
    });
  };

  return (
    <div className="space-y-8">
      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5"
        aria-labelledby="autopilot-schedule-heading"
      >
        <div>
          <h3 id="autopilot-schedule-heading" className="text-sm font-medium">
            On/off and schedule
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose when new posts are prepared for review.
          </p>
        </div>
        <div className="flex min-h-10 items-center justify-between gap-4">
          <Label htmlFor="autopilot-enabled" className="text-sm">
            Autopilot {enabled ? "on" : "off"}
          </Label>
          <Switch
            id="autopilot-enabled"
            className="after:-inset-y-3"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="autopilot-cron">Schedule expression</Label>
          <Input
            id="autopilot-cron"
            value={cronTime}
            onChange={(e) => setCronTime(e.target.value)}
            placeholder="0 8 * * *"
          />
          <p className="text-xs text-muted-foreground">
            Default: 08:00 daily (0 8 * * *)
          </p>
        </div>
        {config?.lastRunAt && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Last run {new Date(config.lastRunAt).toLocaleString()}
          </p>
        )}
      </section>
      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5"
        aria-labelledby="autopilot-content-heading"
      >
        <div>
          <h3 id="autopilot-content-heading" className="text-sm font-medium">
            What gets generated
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Set the daily volume and instructions for generation.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="autopilot-count" className="tabular-nums">
            Posts per day: {postsPerDay}
          </Label>
          <Slider
            id="autopilot-count"
            aria-label="Posts per day"
            className="min-h-10"
            value={[postsPerDay]}
            onValueChange={(val) =>
              setPostsPerDay(Array.isArray(val) ? val[0] : val)
            }
            min={1}
            max={5}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="autopilot-prompt">Prompt template</Label>
          <Textarea
            id="autopilot-prompt"
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={5}
            placeholder="Enter the prompt template for autopilot generation..."
          />
          <p className="text-xs text-muted-foreground">
            Available variables: {"{{brand_name}}"}, {"{{target_audience}}"}
          </p>
        </div>
      </section>
      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5"
        aria-labelledby="autopilot-publish-heading"
      >
        <div>
          <h3 id="autopilot-publish-heading" className="text-sm font-medium">
            After approval
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Publish automatically when a post has been approved.
          </p>
        </div>
        <div className="flex min-h-10 items-center justify-between gap-4">
          <Label htmlFor="autopilot-auto-post">Auto-post after approval</Label>
          <Switch
            id="autopilot-auto-post"
            className="after:-inset-y-3"
            checked={autoPost}
            onCheckedChange={setAutoPost}
          />
        </div>
      </section>
      <div className="sticky bottom-0 bg-background py-3 md:static md:py-0">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="min-h-10 w-full md:w-auto"
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
