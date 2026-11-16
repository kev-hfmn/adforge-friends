// The owner's change requests ("change slide 3"), written in the post sheet. Run `list` at the
// start of every social session, fix what they asked for, then `resolve` each note.
//
// Run from the repo root: set -a && . ./.env.local && set +a && npx tsx scripts/feedback.ts <command>
//
//   list [--project <id|name>]          every open note, oldest first
//   resolve <noteId> "what I changed"   closes the note; when it was the post's last open
//                                       note the post returns to the owner's "Needs review" lane
//   note <postId> "text" [--slide 3]    leave the owner a note on a post (does not move the post)
// A post with an open note is `pending`: it cannot be approved or go out until the note is resolved.
import { db } from "@/lib/db";
import { metadata, postLabel } from "@/lib/queue-view";
import { formatDayTime } from "@/lib/queue-schedule";
import { loadPost, openRequests, requestChanges, resolveNote } from "@/lib/queue-actions";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "list") {
    const projects = await db.query.projects.findMany();
    const want = flag(args, "project");
    const chosen = want
      ? projects.filter((p) => p.id === want || p.name.toLowerCase() === want.toLowerCase())
      : projects;
    if (!chosen.length) throw new Error(`no such project; one of: ${projects.map((p) => p.name).join(", ")}`);
    let total = 0;
    for (const project of chosen) {
      const notes = await openRequests({ projectId: project.id });
      if (!notes.length) continue;
      console.log(`\n${project.name}: ${notes.length} open`);
      for (const note of notes) {
        total++;
        const post = await loadPost(note.postId);
        const spec = metadata(post).spec;
        console.log(`\n  note ${note.id}   ${formatDayTime(note.createdAt)}`);
        console.log(`  post ${post.id}   ${postLabel(post)}  [${post.templateType}, ${post.status}, time ${formatDayTime(post.scheduledAt)}]`);
        if (spec) console.log(`  spec ${spec}`);
        console.log(`  ${note.slide ? `Slide ${note.slide}: ` : ""}${note.body.replace(/\n/g, "\n  ")}`);
      }
    }
    if (!total) console.log("no open notes");
  } else if (command === "resolve") {
    if (!args[0] || !args[1]) throw new Error('usage: feedback.ts resolve <noteId> "what I changed"');
    const note = await resolveNote(args[0], args[1]);
    const left = (await openRequests({ postId: note.postId })).length;
    console.log(left ? `resolved; ${left} more open on this post` : "resolved; the post is back in Needs review");
  } else if (command === "note") {
    if (!args[0] || !args[1]) throw new Error('usage: feedback.ts note <postId> "text" [--slide 3]');
    const slide = flag(args, "slide");
    await requestChanges(await loadPost(args[0]), args[1], slide ? Number(slide) : null, "claude");
    console.log("note left for the owner");
  } else {
    throw new Error('usage: feedback.ts list [--project x] | resolve <noteId> "what I changed" | note <postId> "text" [--slide n]');
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERR", e?.message ?? e); process.exit(1); });
