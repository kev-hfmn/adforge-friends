import { NextRequest, NextResponse } from "next/server";
import { publishPostToInstagram } from "@/lib/publish";

// Admin/smoke-test publish path — same code the queue UI uses.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  // An unset secret must never mean "open": without CRON_SECRET this route is off.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { postId, projectId } = await request.json().catch(() => ({}));
  if (!postId || !projectId) {
    return NextResponse.json({ error: "postId and projectId required" }, { status: 400 });
  }
  try {
    await publishPostToInstagram(postId, projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
