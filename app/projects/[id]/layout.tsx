import { AppShell } from "@/components/AppShell";
import { getProject, getProjects } from "../actions";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { projectNeeds } from "@/lib/queue-context";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ProjectTabs } from "@/components/ProjectTabs";
import { copyMode } from "@/lib/project-rules";
import { HubKeys } from "@/components/hub/HubKeys";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  // eslint-disable-next-line react-hooks/purity
  const needs = await projectNeeds(Date.now());
  const switcher = (await getProjects()).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.brandColor || "#6366f1",
    needs: needs.get(p.id) ?? 0,
  }));

  return (
    <AppShell>
      <div
        className="border-b border-border"
        style={
          {
            "--project-accent": project.brandColor || "#40b0c8",
          } as CSSProperties
        }
      >
        <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-3 px-4 md:px-8">
          <ProjectSwitcher
            current={switcher.find((p) => p.id === id)!}
            projects={switcher}
          />
        </div>
        <ProjectTabs
          projectId={id}
          generator={copyMode(project) === "generator"}
        />
      </div>
      <HubKeys projectId={id} />
      <div className="px-4 py-6 md:px-8 md:py-8">{children}</div>
    </AppShell>
  );
}
