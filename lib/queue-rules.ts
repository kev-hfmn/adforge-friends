// The time rules of the queue, in one place. The buttons (server actions) and
// Claude's script (scripts/queue.ts) both go through these, so neither can skip them.
// Pure functions: no database, no network.
import type { QueuePost } from "./queue-view";

type Timed = Pick<QueuePost, "status" | "scheduledAt">;

export const NO_TIME_MESSAGE =
  "Pick a time first. An approved post without a time never goes out.";
export const PAST_TIME_MESSAGE =
  "That time has passed. Pick a new one before approving.";

/** A time someone typed or picked: must be a real moment in the future. */
export function futureTime(at: number, now = Date.now()): number {
  if (!Number.isFinite(at)) throw new Error("Choose a date and time");
  if (at <= now) throw new Error("Choose a future date and time");
  return at;
}

/**
 * The time an approval will use: the one passed in, else the post's proposed time.
 * Refuses a missing time (the post would never go out) and a passed time (the hourly
 * publisher would send it within the hour, which nobody asked for).
 */
export function approvalTime(
  post: Timed,
  at: number | undefined,
  now = Date.now(),
): number {
  if (at !== undefined) return futureTime(at, now);
  if (post.scheduledAt == null) throw new Error(NO_TIME_MESSAGE);
  if (post.scheduledAt <= now) throw new Error(PAST_TIME_MESSAGE);
  return post.scheduledAt;
}

export type Timing =
  | "scheduled" // approved, time ahead: will go out then
  | "due" // approved, time reached: goes out at the next hourly run
  | "no-time" // approved, no time: will NOT go out
  | "proposed" // waiting for review, with a proposed time ahead
  | "proposal-passed" // waiting for review, proposed time already gone
  | "unplanned" // waiting for review, no time proposed
  | "failed"
  | "posted"
  | "off"; // declined or draft

export function timing(post: Timed, now = Date.now()): Timing {
  const at = post.scheduledAt;
  switch (post.status) {
    case "approved":
      return at == null ? "no-time" : at <= now ? "due" : "scheduled";
    case "pending":
      return at == null ? "unplanned" : at <= now ? "proposal-passed" : "proposed";
    case "failed":
      return "failed";
    case "posted":
      return "posted";
    default:
      return "off";
  }
}

/** Approved posts that will never go out as things stand. */
export function unscheduledApproved<T extends Timed>(posts: T[]): T[] {
  return posts.filter((p) => timing(p) === "no-time");
}
