"use client";

import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SwitcherProject = {
  id: string;
  name: string;
  color: string;
  needs: number;
};

/** The project name in the top bar: tap it to jump to another project or start a new one. */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: SwitcherProject;
  projects: SwitcherProject[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Project: ${current.name}. Switch project`}
        className="-ml-2 flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: current.color }}
        />
        <span className="truncate text-sm font-medium">{current.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            className="min-h-11 gap-3"
            render={<Link href={`/projects/${project.id}/home`} />}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span
              className={`min-w-0 flex-1 truncate ${project.id === current.id ? "font-medium" : ""}`}
            >
              {project.name}
            </span>
            {project.needs > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {project.needs} need you
              </span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          className="min-h-11 gap-3 border-t border-border"
          render={<Link href="/projects/new" />}
        >
          <Plus className="size-4" />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
