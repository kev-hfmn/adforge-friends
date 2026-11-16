import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Circle } from "lucide-react";
import { eq } from "drizzle-orm";
import { getProject, saveBioLink, saveCopyMode, updateProject } from "../../actions";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { knowledgeBase, projectBrandKits } from "@/drizzle/schema";
import { hubOverview } from "@/lib/kb";
import { loadQueueContext } from "@/lib/queue-context";
import { copyMode } from "@/lib/project-rules";
import { listActivity } from "@/lib/api/audit";
import { ActivityList } from "@/components/activity/ActivityList";

export const dynamic = "force-dynamic";

/**
 * Setup, and the checklist a new project starts on: connect a channel, set the
 * rhythm, write the rules, queue the first post. Each step links to its page.
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  // Server request time, evaluated once for this dynamic response.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [context, kit, kb, hub] = await Promise.all([
    loadQueueContext(id, now),
    db.query.projectBrandKits.findFirst({
      where: eq(projectBrandKits.projectId, id),
    }),
    db.query.knowledgeBase.findMany({ where: eq(knowledgeBase.projectId, id) }),
    Promise.resolve(hubOverview(id)),
  ]);
  if (!context) notFound();
  const base = `/projects/${id}`;
  const mode = copyMode(project);
  const activity = listActivity(id);
  const hubCount = hub.counts.reduce((sum, row) => sum + row.n, 0);
  const steps = [
    {
      done: context.connection.active,
      title: "Connect Instagram",
      detail: context.connection.active
        ? `@${context.username}, ${context.connection.label.toLowerCase()}`
        : "Nothing can be published or measured until a channel is connected.",
      href: `${base}/social`,
    },
    {
      done: Boolean(project.bioLink?.trim()),
      title: "Set the site",
      detail: project.bioLink?.trim()
        ? `Link in bio goes to ${project.bioLink}.`
        : "The address for this app. Captions that say link in bio use it, and only it.",
      href: `${base}/setup#setup-site`,
    },
    {
      done: context.slots.length > 0,
      title: "Set the weekly rhythm",
      detail: context.slots.length
        ? context.slots
            .map((s) => `${s.label} ${String(s.hour).padStart(2, "0")}:00`)
            .join(" · ")
        : "The usual days and times. They become the suggested slots when a post needs a time.",
      href: `${base}/autopilot`,
    },
    {
      done: !!(kit?.northStar || kit?.editorialRules || kit?.fullMarkdown),
      title: "Write the brand kit and rules",
      detail:
        "What the project is, how it sounds, and what must never be posted. Writing for this project reads it.",
      href: `${base}/brand-kit`,
    },
    {
      done: hubCount > 0 || kb.some((s) => (s.content ?? "").trim().length > 0),
      title: "Fill the hub",
      detail: "Facts, voice, and lines that must never be posted. Caption checks read this project only.",
      href: `${base}/hub`,
    },
    {
      done: context.posts.length > 0,
      title: "Queue the first post",
      detail: context.posts.length
        ? `${context.posts.length} posts so far.`
        : mode === "generator"
          ? "Draft one in the generator, or place one on Plan. It waits for your OK."
          : "A session queues the post with a time. It waits on Plan for your OK.",
      href: context.posts.length ? `${base}/queue` : mode === "generator" ? `${base}/generate` : `${base}/plan`,
    },
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <div className="max-w-3xl space-y-10">
      <section className="space-y-3" aria-labelledby="setup-steps">
        <div>
          <h2 id="setup-steps" className="text-xl font-semibold tracking-tight">
            {left ? `${left} setup ${left === 1 ? "step" : "steps"} left` : "Setup is complete"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description || "The same steps for every project."}
          </p>
        </div>
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {steps.map((step, index) => {
            const current = index === steps.findIndex((item) => !item.done);
            return (
            <li key={step.title} className="border-b border-border last:border-0">
              <Link
                href={step.href}
                className={`flex min-h-14 items-start gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-ring ${current ? "bg-primary text-primary-foreground hover:brightness-110" : "hover:bg-surface-hover"}`}
              >
                {step.done ? (
                  <Check className={`mt-0.5 size-4 shrink-0 ${current ? "text-primary-foreground" : "text-[var(--project-accent)]"}`} />
                ) : (
                  <Circle className={`mt-0.5 size-4 shrink-0 ${current ? "text-primary-foreground" : "text-muted-foreground"}`} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className={`mt-0.5 block text-xs ${current ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    {step.detail}
                  </span>
                </span>
                <ChevronRight className={`mt-0.5 size-4 shrink-0 ${current ? "text-primary-foreground" : "text-muted-foreground"}`} />
              </Link>
            </li>
            );
          })}
        </ol>
      </section>

      <section id="setup-site" className="space-y-4" aria-labelledby="setup-project">
        <h2 id="setup-project" className="text-sm font-medium">
          Project
        </h2>
        <form
          action={updateProject.bind(null, project.id)}
          className="flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="name" value={project.name} />
          <input
            type="hidden"
            name="description"
            value={project.description ?? ""}
          />
          <label htmlFor="setup-brand-color" className="w-40 text-sm">
            Brand colour
          </label>
          <input
            id="setup-brand-color"
            type="color"
            name="brandColor"
            defaultValue={project.brandColor ?? "#6366f1"}
            className="size-11 cursor-pointer rounded-lg border border-border bg-transparent p-1"
          />
          <Button type="submit" className="min-h-11">
            Save colour
          </Button>
        </form>
        <form action={saveBioLink.bind(null, project.id)} className="flex flex-wrap items-center gap-3">
          <label htmlFor="setup-bio-link" className="w-40 text-sm">
            Site
          </label>
          <input
            id="setup-bio-link"
            name="bioLink"
            defaultValue={project.bioLink ?? ""}
            placeholder="example.com"
            className="min-h-11 min-w-0 flex-1 basis-56 rounded-lg border border-input bg-field px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <Button type="submit" className="min-h-11">
            Save site
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {project.bioLink?.trim()
            ? `TikTok and Facebook captions that say link in bio go to ${project.bioLink}.`
            : "Leave this blank and the words link in bio stay as written."}
        </p>
        <form
          action={saveCopyMode.bind(null, project.id)}
          className="flex flex-wrap items-center gap-3"
        >
          <label htmlFor="setup-copy-mode" className="w-40 text-sm">
            Who writes the copy
          </label>
          <select
            id="setup-copy-mode"
            name="copyMode"
            defaultValue={mode}
            className="min-h-11 min-w-0 flex-1 basis-56 rounded-lg border border-input bg-field px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="claude_session">
              Claude, in a session, from the project rules (no generator)
            </option>
            <option value="generator">
              The built-in generator may draft posts too
            </option>
          </select>
          <Button type="submit" className="min-h-11">
            Save
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {mode === "claude_session"
            ? "The generator is hidden for this project. Every post comes from a Claude session and waits for your OK."
            : "The generator is available under Setup. Its drafts still wait for your OK."}
        </p>
      </section>

      <section id="setup-activity" className="space-y-3" aria-labelledby="setup-activity-heading">
        <h2 id="setup-activity-heading" className="text-sm font-medium">
          Activity
        </h2>
        <ActivityList
          lines={activity}
          empty="No activity yet. It shows up when you or Claude change a post."
        />
      </section>

      <section className="space-y-2" aria-labelledby="setup-now">
        <h2 id="setup-now" className="text-sm font-medium">
          Right now
        </h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>{context.automation}.</li>
          <li>
            {context.nextOut[0]
              ? `${context.nextOut.length} scheduled.`
              : "Nothing is scheduled."}{" "}
            {context.noTime.length
              ? `${context.noTime.length} approved without a time.`
              : ""}
          </li>
        </ul>
      </section>
    </div>
  );
}
