import { queueKind, type QueueKind, type QueuePost } from "./queue-view";

/** The time zone every queue time is shown and entered in. Set NEXT_PUBLIC_TIME_ZONE in .env.local. */
export const QUEUE_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "Europe/Lisbon";
/** "Europe/Lisbon" -> "Lisbon", for labels like "Lisbon time". */
export const QUEUE_ZONE_LABEL = (QUEUE_TIME_ZONE.split("/").pop() ?? QUEUE_TIME_ZONE).replace(/_/g, " ");
// A project's weekly rhythm: which days and hours it usually posts. Set in Setup → Rhythm.
export type WeeklySlot = {
  days: readonly number[];
  hour: number;
  kind: QueueKind;
  label: string;
};
/** An example rhythm (Mon, Wed, Fri at 18:00). Projects start with none until one is saved in Setup. */
export const WEEKLY_SLOTS: ReadonlyArray<WeeklySlot> = [
  { days: [1, 3, 5], hour: 18, kind: "other", label: "Feed post" },
];
export function localInput(at: number): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: QUEUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
  return parts.replace(" ", "T");
}
export function localTimestamp(input: string): number {
  const base = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(base)) return NaN;
  let result = base;
  for (let i = 0; i < 3; i++)
    result += base - Date.parse(`${localInput(result)}:00Z`);
  return localInput(result) === input ? result : NaN;
}
export type QueueSlot = {
  at: number;
  day: string;
  label: string;
  kind: QueueKind;
  postIds: string[];
};
/** A project's usual week: its saved rhythm, or none until it is set in Setup. */
export function projectSlots(project: { rhythmJson?: string | null }): ReadonlyArray<WeeklySlot> {
  try {
    const value: unknown = JSON.parse(project.rhythmJson ?? "null");
    if (Array.isArray(value))
      return value
        .filter(
          (s): s is { label: string; days: number[]; hour: number; kind?: QueueKind } =>
            !!s &&
            typeof s.label === "string" &&
            Array.isArray(s.days) &&
            Number.isInteger(s.hour) &&
            s.hour >= 0 &&
            s.hour < 24,
        )
        .map((s) => ({
          label: s.label,
          days: s.days.filter((d) => Number.isInteger(d) && d >= 0 && d < 7),
          hour: s.hour,
          kind: s.kind ?? "other",
        }));
  } catch {
    /* fall through */
  }
  return [];
}
export function plannedSlots(
  now: number,
  posts: QueuePost[],
  days = 7,
  rhythm: ReadonlyArray<WeeklySlot> = [],
): QueueSlot[] {
  const day = localInput(now).slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  const slots: QueueSlot[] = [];
  for (let i = 0; i < days; i++) {
    const key = date.toISOString().slice(0, 10);
    for (const rule of rhythm.filter((r) =>
      r.days.includes(date.getUTCDay()),
    )) {
      const at = localTimestamp(
        `${key}T${String(rule.hour).padStart(2, "0")}:00`,
      );
      slots.push({
        at,
        day: key,
        label: rule.label,
        kind: rule.kind,
        postIds: posts
          .filter((p) => p.status === "approved" && p.scheduledAt === at)
          .map((p) => p.id),
      });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return slots;
}
export function nextOpenSlot(
  post: QueuePost,
  posts: QueuePost[],
  now = Date.now(),
  rhythm: ReadonlyArray<WeeklySlot> = [],
): number {
  const kind = queueKind(post);
  const others = posts.filter((p) => p.id !== post.id);
  const slots = plannedSlots(now, others, 366, rhythm);
  const free =
    slots.find((s) => s.at > now && !s.postIds.length && s.kind === kind)?.at ??
    slots.find((s) => s.at > now && !s.postIds.length)
      ?.at;
  if (free != null) return free;
  // No rhythm (a new project), or every slot taken: the next day at 18:00 that has
  // nothing approved on it.
  const taken = new Set(
    others
      .filter((p) => p.status === "approved" && p.scheduledAt != null)
      .map((p) => localInput(p.scheduledAt!).slice(0, 10)),
  );
  const date = new Date(`${localInput(now).slice(0, 10)}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    const key = date.toISOString().slice(0, 10);
    const at = localTimestamp(`${key}T18:00`);
    if (at > now && !taken.has(key)) return at;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return now + 86400000;
}
export function nextDailyRun(
  cron: string | null | undefined,
  now = Date.now(),
): number {
  const [minute = "0", hour = "8"] = (cron ?? "0 8 * * *").split(/\s+/);
  // Daily engine reads the hour field. Keep the strip aligned to the stored cron.
  const h = /^\d+$/.test(hour) && +hour < 24 ? +hour : 8;
  const m = /^\d+$/.test(minute) && +minute < 60 ? +minute : 0;
  const day = localInput(now).slice(0, 10);
  let at = localTimestamp(
    `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  );
  if (at <= now) {
    const tomorrow = new Date(`${day}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    at = localTimestamp(
      `${tomorrow.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
  return at;
}
export function formatTime(at: number | null | undefined): string {
  return at == null
    ? "Not set"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: QUEUE_TIME_ZONE,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(at);
}
/** "Sat 14 Nov, 18:00" in the queue's time zone. */
export function formatDayTime(at: number | null | undefined): string {
  return at == null
    ? "No time"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: QUEUE_TIME_ZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(at)
        .replace(",", "");
}
export type Schedulable = {
  id: string;
  projectId: string | null;
  status: string | null;
  scheduledAt: number | null;
};
export function isDueScheduled(post: Schedulable, now: number): boolean {
  return (
    post.status === "approved" &&
    post.scheduledAt != null &&
    post.scheduledAt <= now &&
    !!post.projectId
  );
}
export async function runDueScheduled<T extends Schedulable>(
  posts: T[],
  now: number,
  effects: {
    connected: (post: T) => Promise<boolean>;
    publish: (post: T) => Promise<void>;
    fail: (post: T, error: string) => Promise<void>;
  },
) {
  for (const post of [...posts]
    .filter((p) => isDueScheduled(p, now))
    .sort((a, b) => a.scheduledAt! - b.scheduledAt!)) {
    if (!(await effects.connected(post))) continue;
    try {
      await effects.publish(post);
    } catch (error) {
      await effects.fail(
        post,
        error instanceof Error ? error.message : "Publish failed",
      );
    }
  }
}
