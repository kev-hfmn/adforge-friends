import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { autopilotConfig, projects } from "@/drizzle/schema";
import { AutopilotForm } from "@/components/AutopilotForm";
import { RhythmForm } from "@/components/RhythmForm";
import { projectSlots } from "@/lib/queue-schedule";

export default async function AutopilotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, config] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    db.query.autopilotConfig.findFirst({
      where: eq(autopilotConfig.projectId, id),
    }),
  ]);
  if (!project) notFound();
  const slots = projectSlots(project);

  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Rhythm and automation
        </h2>
        <p className="text-sm text-muted-foreground">
          When posts usually go out, and what is drafted without anyone asking.
        </p>
      </div>
      <RhythmForm
        projectId={id}
        initial={slots.map((s) => ({
          label: s.label,
          days: [...s.days],
          hour: s.hour,
          kind: s.kind,
        }))}
        saved={project.rhythmJson != null}
      />
      <div className="space-y-4 border-t border-border pt-8">
        <h3 className="text-sm font-medium">Automatic drafts</h3>
        <AutopilotForm projectId={id} config={config || null} />
      </div>
    </div>
  );
}
