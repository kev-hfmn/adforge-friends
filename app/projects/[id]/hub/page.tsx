import { QUEUE_TIME_ZONE } from "@/lib/queue-schedule";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryForm } from "@/components/hub/EntryForm";
import { hubEntry, hubList, hubOverview } from "@/lib/kb";
import { KB_TYPE_LABELS, isKbType, type KbType } from "@/lib/kb-types";
import {
  addHubEntry,
  discardTaste,
  keepTaste,
  restoreHubVersion,
  saveHubEntry,
} from "./actions";

const FIELD_LABELS: Record<string, string> = {
  claim: "Claim",
  grade: "Grade",
  safeWording: "Safe wording",
  neverSay: "Never say",
  source: "Source",
  link: "Link",
  allowedNumbers: "Allowed numbers",
  rule: "Rule",
  doExample: "Do this",
  dontExample: "Not this",
  pattern: "Pattern",
  reason: "Reason",
  replacement: "Use instead",
  myth: "Myth",
  whatIsTrue: "What is true",
  date: "Date",
  what: "What",
  verdict: "Verdict",
  beats: "Beats",
  checklist: "Gate",
  before: "Before",
  after: "After",
  correction: "Correction",
  sentence: "Key sentence",
  share: "Share",
  goal: "Goal",
  post: "Post",
  format: "Format",
  results: "Results",
};

function zoned(at: number | null): string {
  if (!at) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: QUEUE_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(at));
}

function href(projectId: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const text = params.toString();
  return `/projects/${projectId}/hub${text ? `?${text}` : ""}`;
}

function stringFields(fields: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; type?: string; status?: string; entry?: string; new?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const overview = hubOverview(id);
  if (!overview) notFound();
  const q = search.q?.trim() ?? "";
  const type = search.type && isKbType(search.type) ? search.type : "";
  const status = search.status === "draft" ? "draft" : "active";
  const creating = search.new === "1";
  const detail = search.entry ? hubEntry(id, search.entry) : null;
  const list = detail || creating ? [] : hubList(id, { q, type, status });
  const total = overview.counts.reduce((sum, row) => sum + row.n, 0);
  const health = overview.health;

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start">
      <nav aria-label="Hub types" className="space-y-4 md:sticky md:top-4 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
        <form action={href(id, { type, status })} className="flex gap-2">
          {type && <input type="hidden" name="type" value={type} />}
          {status === "draft" && <input type="hidden" name="status" value="draft" />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search the hub"
            aria-label="Search the hub"
            className="min-h-11 w-full rounded-lg border border-input bg-field px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>
        <div className="flex gap-2 overflow-x-auto md:flex-col">
          <TypeLink projectId={id} label="All" count={total} active={!type && status === "active" && !creating} />
          {(health?.drafts ?? 0) > 0 && (
            <TypeLink
              projectId={id}
              label="To review"
              count={health?.drafts ?? 0}
              query={{ status: "draft" }}
              active={status === "draft" && !type}
            />
          )}
          {overview.counts.map((row) => (
            <TypeLink
              key={row.type}
              projectId={id}
              label={isKbType(row.type) ? KB_TYPE_LABELS[row.type] : row.type}
              count={row.n}
              query={{ type: row.type }}
              active={type === row.type && status === "active"}
            />
          ))}
          <Link href={href(id, { new: "1" })} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-110">
            Add entry
          </Link>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">N starts a new entry.</p>
      </nav>
      <div className="min-w-0 space-y-6">
        {health && status === "active" && !detail && !creating && (
          <Health projectId={id} health={health} />
        )}
        {creating && (
          <section className="space-y-4">
            <h2 className="text-xl font-medium">New entry</h2>
            <EntryForm action={addHubEntry.bind(null, id)} />
          </section>
        )}
        {search.entry && !detail && <p className="text-sm text-muted-foreground">That entry is not in this project.</p>}
        {detail && (
          <Entry
            projectId={id}
            detail={detail}
          />
        )}
        {!detail && !creating && list.length >= 80 && (
          <p className="text-xs text-muted-foreground">Showing 80. Search to narrow.</p>
        )}
        {!detail && !creating && (
          <ul className="divide-y divide-border/60">
            {list.length === 0 && (
              <li className="py-8 text-sm text-muted-foreground">
                {total === 0 ? (
                  "This hub is empty. Add a fact, a voice rule, or a banned line. Caption checks read only this project."
                ) : (
                  <>
                    Nothing in this list.{" "}
                    <Link
                      href={href(id, {})}
                      className="inline-flex min-h-11 items-center text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Clear the search
                    </Link>
                  </>
                )}
              </li>
            )}
            {list.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={href(id, { q, type, status: status === "draft" ? "draft" : undefined, entry: entry.id })}
                  className="flex min-h-11 items-baseline justify-between gap-4 py-2 text-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="font-medium">{entry.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {isKbType(entry.type) ? KB_TYPE_LABELS[entry.type] : entry.type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TypeLink({
  projectId,
  label,
  count,
  query,
  active,
}: {
  projectId: string;
  label: string;
  count?: number;
  query?: Record<string, string>;
  active: boolean;
}) {
  return (
    <Link
      href={href(projectId, query ?? {})}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      <span>{label}</span>
      {count != null && <span className="tabular-nums">{count}</span>}
    </Link>
  );
}

function Health({
  projectId,
  health,
}: {
  projectId: string;
  health: NonNullable<ReturnType<typeof hubOverview>["health"]>;
}) {
  const lines = [
    health.drafts ? `${health.drafts} taste drafts to review` : "",
    health.factsNoSource ? `${health.factsNoSource} facts with no source` : "",
    health.pillarsWithoutExamples.length
      ? `${health.pillarsWithoutExamples.length} pillars with no example yet`
      : "",
    health.unused ? `${health.unused} entries unused for 60 days` : "",
    ...health.warnings.map((warning) => `${warning.file}: ${warning.message}`),
  ].filter(Boolean);
  if (!lines.length) return <p className="text-sm text-muted-foreground">Hub health: nothing waiting.</p>;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {lines.map((line) => (
        <li key={line}>
          {health.drafts && line.startsWith(String(health.drafts)) ? (
            <Link href={href(projectId, { status: "draft" })} className="underline-offset-2 hover:underline">
              {line}
            </Link>
          ) : (
            line
          )}
        </li>
      ))}
    </ul>
  );
}

function Entry({
  projectId,
  detail,
}: {
  projectId: string;
  detail: NonNullable<ReturnType<typeof hubEntry>>;
}) {
  const { entry } = detail;
  const synced = entry.source.startsWith("synced:");
  const file = synced ? entry.source.replace(/^synced:/, "") : "";
  const fields = Object.entries(entry.fields).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : value.trim().length > 0,
  );
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {isKbType(entry.type) ? KB_TYPE_LABELS[entry.type] : entry.type}
          {entry.status === "draft" ? " · draft" : ""}
        </p>
        <h2 className="text-xl font-medium leading-snug">{entry.title}</h2>
        {synced ? (
          <p className="text-sm text-muted-foreground">
            Synced from {file}. Edit that doc. Last sync update {zoned(entry.updatedAt)}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Written here. Updated {zoned(entry.updatedAt)}.</p>
        )}
      </header>
      {entry.status === "draft" && (
        <div className="flex flex-wrap gap-2">
          <form action={keepTaste.bind(null, projectId, entry.id)}>
            <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Keep
            </button>
          </form>
          <form action={discardTaste.bind(null, projectId, entry.id)}>
            <button type="submit" className="min-h-11 rounded-lg border border-border px-4 text-sm">
              Discard
            </button>
          </form>
        </div>
      )}
      {fields.length > 0 && (
        <dl className="space-y-3 text-sm">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{FIELD_LABELS[key] ?? key}</dt>
              <dd className="whitespace-pre-wrap">
                {Array.isArray(value) ? (
                  key === "beats" || key === "checklist" ? (
                    <ol className="list-decimal space-y-1 pl-5">
                      {value.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                      ))}
                    </ol>
                  ) : (
                    value.join(", ")
                  )
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {entry.body && entry.type !== "fact" && entry.type !== "banned" && (
        <p className="whitespace-pre-wrap text-sm leading-6">{entry.body}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Used in {detail.posts.length} {detail.posts.length === 1 ? "post" : "posts"}
        {detail.bestReach != null ? `. Best reach ${detail.bestReach}.` : "."}
      </p>
      {detail.posts.length > 0 && (
        <ul className="space-y-1 text-sm">
          {detail.posts.map((post) => (
            <li key={post.id}>
              <Link href={`/projects/${projectId}/queue?post=${post.id}`} className="hover:underline">
                {post.headline || "Post"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {detail.versions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">History</h3>
          <ul className="space-y-2 text-sm">
            {detail.versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {zoned(version.createdAt)} · {version.editor || "edit"} · {version.title}
                </span>
                {!synced && (
                  <form action={restoreHubVersion.bind(null, projectId, entry.id, version.id)}>
                    <button type="submit" className="min-h-11 px-2 text-sm underline-offset-2 hover:underline">
                      Restore
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!synced && (
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Edit</h3>
          <EntryForm
            lockType
            action={saveHubEntry.bind(null, projectId, entry.id)}
            initial={{
              type: entry.type as KbType,
              title: entry.title,
              body: entry.body,
              fields: stringFields(entry.fields),
            }}
          />
        </section>
      )}
    </article>
  );
}
