import { NextRequest, NextResponse } from "next/server";
import { zernioConnectUrl, type ZernioPlatform } from "@/lib/zernio";

// Facebook goes direct on our Meta app (app/api/auth/facebook); Zernio is TikTok only.
const PLATFORMS: ZernioPlatform[] = ["tiktok"];

// Starts a TikTok connection through Zernio. Behind the AdForge password;
// the callback comes back to the same signed-in browser.
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const platform = request.nextUrl.searchParams.get("platform") as ZernioPlatform;
  if (!projectId || !PLATFORMS.includes(platform))
    return NextResponse.json({ error: "Missing projectId or platform" }, { status: 400 });
  const base = (process.env.BASE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const back = `${base}/api/auth/zernio/callback?${new URLSearchParams({ projectId, platform })}`;
  try {
    return NextResponse.redirect(await zernioConnectUrl(platform, back));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "connect_failed";
    return NextResponse.redirect(
      new URL(`/projects/${projectId}/social?error=${encodeURIComponent(msg)}`, base),
    );
  }
}
