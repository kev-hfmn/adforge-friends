// Publish one queued post to Instagram right now (the owner said "publish now").
// Run from the repo root: set -a && . ./.env.local && set +a && npx tsx scripts/publish-now.ts <postId>
// The post must already be approved (or pending with the owner's explicit OK in chat). Prints the permalink.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedPosts } from "@/drizzle/schema";
import { publishPostToInstagram } from "@/lib/publish";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("usage: publish-now.ts <postId>");
  const post = await db.query.generatedPosts.findFirst({ where: eq(generatedPosts.id, id) });
  if (!post?.projectId) throw new Error("post not found");
  console.log("before:", post.status);
  await publishPostToInstagram(id, post.projectId);
  const after = await db.query.generatedPosts.findFirst({ where: eq(generatedPosts.id, id) });
  console.log("after:", after?.status, after?.publishError ?? "", JSON.stringify(after).match(/https:\/\/www\.instagram\.com\/[^"]+/)?.[0] ?? "");
}
main().then(() => process.exit(0)).catch(e => { console.error("ERR", e?.message ?? e); process.exit(1); });
