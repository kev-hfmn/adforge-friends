// Activity rows for the agent interface. Reads return an empty list before the table exists.
import { sqlite } from "@/lib/db";
import { formatDayTime } from "@/lib/queue-schedule";

export type Actor = "owner" | "claude" | "cron";

export type AuditRow = {
  id: string;
  projectId: string | null;
  actor: string;
  action: string;
  target: string;
  beforeSummary: string | null;
  afterSummary: string | null;
  quote: string | null;
  createdAt: number | null;
};

const VERBS: Record<string, string> = {
  idea_create: "added an idea",
  idea_update: "updated an idea",
  post_create_draft: "created a draft",
  post_update_copy: "changed the caption",
  post_set_variant: "set a channel caption",
  post_propose_time: "proposed a time",
  note_add: "added a note",
  note_resolve: "resolved a note",
  suggestion_add: "added a suggestion",
  kb_add_entry: "added a hub entry",
  kb_update_entry: "updated a hub entry",
  taste_confirm: "confirmed a taste draft",
  report_save: "saved the weekly report",
  asset_tag: "tagged an asset",
  approve_week: "marked the week approved",
};

function missing(error: unknown): boolean {
  return /no such table/i.test(String(error));
}

export function activitySentence(row: Pick<AuditRow, "actor" | "action" | "afterSummary" | "quote" | "createdAt">): string {
  const who = row.actor === "owner" ? "You" : row.actor === "cron" ? "The hourly job" : "Claude";
  const verb = VERBS[row.action] ?? row.action.replaceAll("_", " ");
  const when = formatDayTime(row.createdAt);
  const extra = row.afterSummary?.trim() ? ` ${row.afterSummary.trim()}` : "";
  const quote = row.quote?.trim() ? ` The owner said: ${row.quote.trim()}` : "";
  return `${who} ${verb}, ${when}.${extra}${quote}`;
}

export function recordAudit(input: {
  projectId: string | null;
  actor: Actor;
  action: string;
  target: string;
  beforeSummary?: string | null;
  afterSummary?: string | null;
  quote?: string | null;
}): void {
  sqlite
    .prepare(
      `INSERT INTO audit_log
        (id, project_id, actor, action, target, before_summary, after_summary, quote, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      crypto.randomUUID(),
      input.projectId,
      input.actor,
      input.action,
      input.target,
      input.beforeSummary ?? null,
      input.afterSummary ?? null,
      input.quote ?? null,
      Date.now(),
    );
}

function rowsFor(projectId: string, target?: string): AuditRow[] {
  const sql = target
    ? `SELECT id, project_id AS projectId, actor, action, target, before_summary AS beforeSummary,
              after_summary AS afterSummary, quote, created_at AS createdAt
       FROM audit_log WHERE project_id = ? AND target = ? ORDER BY created_at DESC LIMIT 40`
    : `SELECT id, project_id AS projectId, actor, action, target, before_summary AS beforeSummary,
              after_summary AS afterSummary, quote, created_at AS createdAt
       FROM audit_log WHERE project_id = ? ORDER BY created_at DESC LIMIT 40`;
  const statement = sqlite.prepare(sql);
  return (target ? statement.all(projectId, target) : statement.all(projectId)) as AuditRow[];
}

export function listActivity(projectId: string, postId?: string): { id: string; text: string }[] {
  try {
    const rows = rowsFor(projectId, postId ? `post:${postId}` : undefined);
    return rows.map((row) => ({ id: row.id, text: activitySentence(row) }));
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
}
