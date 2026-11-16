import { NextRequest, NextResponse } from "next/server";
import { signOAuthState } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    state: await signOAuthState(projectId),
  });

  return NextResponse.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
}
