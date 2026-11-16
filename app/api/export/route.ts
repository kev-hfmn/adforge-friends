import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedPosts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  const format = request.nextUrl.searchParams.get("format") || "png";

  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Check if pre-rendered image exists
  if (post.imagePath) {
    const filePath = path.join(process.cwd(), "public", post.imagePath);
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      const contentType = format === "webp" ? "image/webp" : "image/png";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${postId}.${format}"`,
        },
      });
    }
  }

  return NextResponse.json({ error: "Image not yet rendered. Render it first." }, { status: 404 });
}
