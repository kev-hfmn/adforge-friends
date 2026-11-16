import { NextRequest, NextResponse } from "next/server";
import { renderVideoPost } from "@/lib/render-video";
import { db } from "@/lib/db";
import { generatedPosts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { postId } = await req.json();
  // VIDEO_RENDER=off on a server without Chrome: Remotion cannot render there.
  if (process.env.VIDEO_RENDER === "off") {
    return NextResponse.json(
      { error: `Video rendering is off on this server. On a machine with Chrome run: npx tsx scripts/render-video-one.ts ${postId ?? "<postId>"}` },
      { status: 409 },
    );
  }
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.templateType !== "reel") {
    return NextResponse.json({ error: "Video render only available for reel posts" }, { status: 400 });
  }

  try {
    const videoPath = await renderVideoPost(postId);
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    return NextResponse.json({ path: videoPath, url: `${baseUrl}${videoPath}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
