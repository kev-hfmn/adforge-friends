import { NextRequest, NextResponse } from "next/server";
import { signOAuthState } from "@/lib/auth";
import { facebookLoginUrl, facebookRedirectUri } from "@/lib/facebook";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  try {
    return NextResponse.redirect(
      facebookLoginUrl(facebookRedirectUri(request.nextUrl.origin), await signOAuthState(projectId)),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "connect_failed";
    return NextResponse.redirect(
      new URL(`/projects/${projectId}/social?error=${encodeURIComponent(msg)}`, request.nextUrl.origin),
    );
  }
}
