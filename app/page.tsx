import { AppShell } from "@/components/AppShell";
import { db } from "@/lib/db";
import { projectNeeds } from "@/lib/queue-context";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Counts come from the live queue, so this page is never prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  // What waits for the owner in each project: to review, approved without a time, failed.
  // eslint-disable-next-line react-hooks/purity
  const needs = await projectNeeds(Date.now());

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <Button className="min-h-10" nativeButton={false} render={<Link href="/projects/new" />}>
            <Plus className="size-4" />
            New project
          </Button>
        </header>
        <div className="space-y-3">
          {allProjects.map((project) => {
            const waiting = needs.get(project.id) ?? 0;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/home`}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring md:p-5"
              >
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.brandColor || "#40b0c8" }}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-sm font-medium">
                    {project.name}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {project.description || "No description yet"}
                  </p>
                </div>
                <span
                  className={`mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs tabular-nums ${waiting ? "text-foreground" : "text-muted-foreground"}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${waiting ? "bg-amber-500" : "bg-muted-foreground"}`}
                  />
                  {waiting ? `${waiting} need you` : "Nothing waiting"}
                </span>
              </Link>
            );
          })}
          {allProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Create a project to start preparing posts for review.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
