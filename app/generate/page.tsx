import { db } from "@/lib/db";
import { projects } from "@/drizzle/schema";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";
import { QuickGenerateForm } from "@/components/QuickGenerateForm";

export default async function QuickGeneratePage() {
  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
  });

  return (
    <AppShell>
      <div className="border-b border-border">
        <div className="flex h-16 items-center px-4 md:px-8">
          <h1 className="text-xl font-semibold tracking-tight">
            Quick generate
          </h1>
        </div>
      </div>
      {allProjects.length === 0 ? (
        <div className="space-y-4 px-4 py-6 md:px-8 md:py-8">
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a project first to use Quick generate.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex min-h-10 items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create project
          </Link>
        </div>
      ) : (
        <QuickGenerateForm projects={allProjects} />
      )}
    </AppShell>
  );
}
