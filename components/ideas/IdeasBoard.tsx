"use client";

import { useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveIdeaAction, turnIdeaIntoPostAction } from "@/app/projects/[id]/ideas/actions";
import { IDEA_COLUMNS, type IdeaStatus } from "@/lib/ideas";

export type IdeaCard = {
  id: string;
  title: string;
  body: string;
  pillar: string | null;
  format: string | null;
  status: IdeaStatus;
  createdBy: "owner" | "claude";
  postId: string | null;
};

// Optional colors per content pillar label. Unlisted pillars use the neutral tag.
const PILLAR: Record<string, string> = {};

const FORMAT: Record<string, string> = {
  reel: "Reel",
  carousel: "Carousel",
  photo: "Photo",
};

function PillarTag({ pillar }: { pillar: string }) {
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[12px] ${PILLAR[pillar] ?? "border-border bg-muted text-muted-foreground"}`}
    >
      {pillar}
    </span>
  );
}

function IdeaCardView({
  projectId,
  idea,
  pending,
  onMove,
}: {
  projectId: string;
  idea: IdeaCard;
  pending: boolean;
  onMove: (id: string, status: IdeaStatus) => void;
}) {
  return (
    <article className="space-y-2 rounded-lg border border-border bg-card p-3 motion-reduce:transition-none">
      <h3
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", idea.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        className="cursor-grab text-sm font-medium active:cursor-grabbing"
        title="Drag to another column, or use Move"
      >
        {idea.title}
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {idea.pillar ? <PillarTag pillar={idea.pillar} /> : null}
        {idea.format ? (
          <span className="text-[12px] text-muted-foreground">{FORMAT[idea.format] ?? idea.format}</span>
        ) : null}
        <span className="text-[12px] text-muted-foreground">{idea.createdBy === "claude" ? "Claude" : "You"}</span>
      </div>
      {idea.body ? <p className="line-clamp-3 text-[13px] text-muted-foreground">{idea.body}</p> : null}
      <label className="block text-[12px] text-muted-foreground" htmlFor={`move-${idea.id}`}>
        Move
        <select
          id={`move-${idea.id}`}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-field px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          value={idea.status}
          disabled={pending}
          onChange={(event) => onMove(idea.id, event.target.value as IdeaStatus)}
        >
          {IDEA_COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.label}
            </option>
          ))}
        </select>
      </label>
      {idea.postId ? (
        <Link
          href={`/projects/${projectId}/ideas?post=${idea.postId}`}
          scroll={false}
          className="inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Open draft
        </Link>
      ) : idea.status === "dropped" || idea.status === "done" ? null : (
        <form action={turnIdeaIntoPostAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="ideaId" value={idea.id} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Turn into post
          </button>
        </form>
      )}
    </article>
  );
}

export function IdeasBoard({ projectId, ideas }: { projectId: string; ideas: IdeaCard[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<IdeaStatus | null>(null);

  const move = (id: string, status: IdeaStatus) => {
    const idea = ideas.find((item) => item.id === id);
    if (!idea || idea.status === status) return;
    start(async () => {
      try {
        await moveIdeaAction(projectId, id, status);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not move it");
      }
    });
  };

  const dropOn = (status: IdeaStatus, event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    setOver(null);
    if (id) move(id, status);
  };

  return (
    <>
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
        {IDEA_COLUMNS.map((column) => {
          const cards = ideas.filter((idea) => idea.status === column.id);
          return (
            <section
              key={column.id}
              aria-label={column.label}
              className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-2 ${over === column.id ? "border-[var(--queue-accent)] bg-muted" : "border-border"}`}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.id);
              }}
              onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
              onDrop={(event) => dropOn(column.id, event)}
            >
              <h2 className="flex items-baseline justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {column.label}
                <span className="tabular-nums">{cards.length}</span>
              </h2>
              <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-2 overflow-y-auto">
                {cards.map((idea) => (
                  <IdeaCardView key={idea.id} projectId={projectId} idea={idea} pending={pending} onMove={move} />
                ))}
                {!cards.length ? (
                  column.id === "inbox" ? (
                    <Link
                      href={`/projects/${projectId}/ideas/new`}
                      className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Add an idea
                    </Link>
                  ) : (
                    <p className="px-1 py-2 text-[13px] text-muted-foreground">Move one here</p>
                  )
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      <div className="space-y-6 md:hidden">
        {ideas.length ? (
          IDEA_COLUMNS.filter((column) => ideas.some((idea) => idea.status === column.id)).map((column) => (
            <section key={column.id} aria-label={column.label} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {column.label}
              </h2>
              {ideas
                .filter((idea) => idea.status === column.id)
                .map((idea) => (
                  <IdeaCardView key={idea.id} projectId={projectId} idea={idea} pending={pending} onMove={move} />
                ))}
            </section>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No ideas yet.{" "}
            <Link
              href={`/projects/${projectId}/ideas/new`}
              className="inline-flex min-h-11 items-center text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Add one
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
