// Render one reel post's video with Remotion from the command line.
//   npx tsx scripts/render-video-one.ts <postId>
// ADFORGE_DB picks another database file (default ./db.sqlite).
import { renderVideoPost } from "../lib/render-video";

const postId = process.argv[2];
if (!postId) {
  console.error("usage: render-video-one.ts <postId>");
  process.exit(1);
}
renderVideoPost(postId)
  .then((p) => { console.log(p); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
