// Send a post that is already live on Instagram to TikTok and/or Facebook on purpose.
// The automatic flow only sends posts that went live after a channel was linked.
// This PUBLISHES: run it only with the owner's OK for that post.
//   set -a && . ./.env.local && set +a && npx tsx scripts/crosspost.ts send <postId> [tiktok,facebook]
//   ... scripts/crosspost.ts status <postId>
//   ... scripts/crosspost.ts fb-thumbnail <postId>   set the Facebook reel thumbnail to the post's cover
async function main() {
  const [cmd, postId, to = "tiktok,facebook"] = process.argv.slice(2);
  if (!postId || !["send", "status", "fb-thumbnail"].includes(cmd)) {
    console.log("usage: crosspost.ts send <postId> [tiktok,facebook] | status <postId> | fb-thumbnail <postId>");
    process.exit(1);
  }
  const { crosspostNow, fixFacebookThumbnail, publicationsFor } = await import("@/lib/crosspost");
  if (cmd === "send") await crosspostNow(postId, to.split(","));
  if (cmd === "fb-thumbnail") {
    await fixFacebookThumbnail(postId);
    console.log("Facebook thumbnail set to the cover image");
  }
  for (const p of await publicationsFor(postId))
    console.log(`${p.platform.padEnd(9)} ${p.status}  ${p.url ?? p.error ?? ""}`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
