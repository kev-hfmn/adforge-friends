// The queue from the command line: the same actions and the same time rules as the buttons
// (lib/queue-actions.ts, lib/queue-rules.ts). Nothing here publishes.
//
// Run from the repo root: set -a && . ./.env.local && set +a && npx tsx scripts/queue.ts <command>
//
//   list [--project <id|name>] [--lane review|scheduled|no-time|failed|posted]
//   propose <postId> <YYYY-MM-DDTHH:mm>     proposed time on a post in review, or move an approved post
//   approve <postId> [--at <YYYY-MM-DDTHH:mm>]   refuses a missing or passed time
//   approve-week [--project <id|name>]      approves every post in review that has a proposed future time
//   review <postId>                          back to review (keeps the time as a proposal)
//   decline <postId>
//   channel <postId> facebook|instagram      Facebook only, or back to Instagram first (posts not yet out)
// Times are in QUEUE_TIME_ZONE (NEXT_PUBLIC_TIME_ZONE), as in the app.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedPosts } from "@/drizzle/schema";
import { metadata, postLabel, targetChannel, type QueuePost } from "@/lib/queue-view";
import { formatDayTime, localTimestamp, QUEUE_TIME_ZONE } from "@/lib/queue-schedule";
import { timing, type Timing } from "@/lib/queue-rules";
import { approveAt, backToReview, decline, loadPost, setTime } from "@/lib/queue-actions";

const LANES: Record<string, Timing[]> = {
  review: ["proposed", "proposal-passed", "unplanned"],
  scheduled: ["scheduled", "due"],
  "no-time": ["no-time"],
  failed: ["failed"],
  posted: ["posted"],
};
const WORDS: Record<Timing, string> = {
  scheduled: "scheduled",
  due: "due, next hourly run",
  "no-time": "APPROVED, NO TIME: will not go out",
  proposed: "in review, time proposed",
  "proposal-passed": "in review, PROPOSED TIME PASSED",
  unplanned: "in review, no time proposed",
  failed: "FAILED",
  posted: "posted",
  off: "off",
};

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function when(input: string | undefined): number {
  if (!input) throw new Error("time needed, as YYYY-MM-DDTHH:mm");
  const at = localTimestamp(input);
  if (!Number.isFinite(at)) throw new Error(`not a ${QUEUE_TIME_ZONE} time: ${input} (use YYYY-MM-DDTHH:mm)`);
  return at;
}
async function projectPosts(args: string[]): Promise<QueuePost[]> {
  const projects = await db.query.projects.findMany();
  const want = flag(args, "project");
  const project = want
    ? projects.find((p) => p.id === want || p.name.toLowerCase() === want.toLowerCase())
    : projects.length === 1 ? projects[0] : undefined;
  if (!project) throw new Error(`--project needed, one of: ${projects.map((p) => p.name).join(", ")}`);
  return db.query.generatedPosts.findMany({ where: eq(generatedPosts.projectId, project.id) });
}
function line(p: QueuePost): string {
  const at = p.status === "posted" ? p.postedAt : p.scheduledAt;
  return `${p.id}  ${formatDayTime(at).padEnd(18)} ${WORDS[timing(p)].padEnd(36)} ${p.templateType?.padEnd(8)} ${targetChannel(p) === "facebook" ? "[FB only] " : ""}${postLabel(p).slice(0, 60)}`;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "list") {
    const lane = flag(args, "lane");
    if (lane && !LANES[lane]) throw new Error(`lane is one of: ${Object.keys(LANES).join(", ")}`);
    const posts = (await projectPosts(args))
      .filter((p) => (lane ? LANES[lane].includes(timing(p)) : !["off", "posted"].includes(timing(p))))
      .sort((a, b) => (a.scheduledAt ?? a.postedAt ?? Infinity) - (b.scheduledAt ?? b.postedAt ?? Infinity));
    for (const p of posts) console.log(line(p));
    if (!posts.length) console.log("nothing here");
  } else if (command === "propose") {
    const post = await loadPost(args[0]);
    console.log("time set:", formatDayTime(await setTime(post, when(args[1]))), `(${post.status})`);
  } else if (command === "approve") {
    const at = flag(args, "at");
    const time = await approveAt(await loadPost(args[0]), at ? when(at) : undefined);
    console.log("approved for", formatDayTime(time));
  } else if (command === "approve-week") {
    const waiting = (await projectPosts(args)).filter((p) => p.status === "pending");
    let refused = 0;
    for (const p of waiting.sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity))) {
      try {
        console.log("approved ", formatDayTime(await approveAt(p)).padEnd(18), postLabel(p).slice(0, 60));
      } catch (e) {
        refused++;
        console.log("REFUSED  ", p.id, postLabel(p).slice(0, 40), "→", e instanceof Error ? e.message : e);
      }
    }
    if (!waiting.length) console.log("nothing in review");
    if (refused) process.exitCode = 1;
  } else if (command === "review") {
    await backToReview(await loadPost(args[0]));
    console.log("back in review");
  } else if (command === "decline") {
    await decline(await loadPost(args[0]));
    console.log("declined");
  } else if (command === "channel") {
    const post = await loadPost(args[0]);
    const to = args[1];
    if (to !== "facebook" && to !== "instagram") throw new Error("channel is facebook or instagram");
    if (post.status === "posted") throw new Error("already published; the channel cannot change");
    const rest = metadata(post);
    delete rest.channel;
    await db
      .update(generatedPosts)
      .set({ metadata: JSON.stringify(to === "facebook" ? { ...rest, channel: "facebook" } : rest) })
      .where(eq(generatedPosts.id, post.id));
    console.log(to === "facebook" ? "Facebook only" : "Instagram first (then Facebook and TikTok)");
  } else {
    throw new Error("usage: queue.ts list | propose <id> <time> | approve <id> [--at <time>] | approve-week | review <id> | decline <id> | channel <id> facebook|instagram");
  }
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error("ERR", e?.message ?? e); process.exit(1); });
