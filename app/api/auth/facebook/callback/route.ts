import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, socialChannels } from "@/drizzle/schema";
import { verifyOAuthState } from "@/lib/auth";
import { choosePage, facebookPagesFromCode, facebookRedirectUri } from "@/lib/facebook";

// Public path (proxy.ts): it proves itself with the signed state, like Instagram's.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const origin = (process.env.BASE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const projectId = await verifyOAuthState(q.get("state"));
  if (!projectId) return NextResponse.redirect(new URL("/?error=oauth_state_invalid_or_expired", origin));
  const back = (error?: string) =>
    NextResponse.redirect(
      new URL(`/projects/${projectId}/social${error ? `?error=${encodeURIComponent(error)}` : ""}`, origin),
    );
  if (q.get("error")) return back(q.get("error_description") || q.get("error") || "Facebook login failed");
  const code = q.get("code");
  if (!code) return back("Facebook returned no code");
  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), columns: { name: true } });
    const page = choosePage(
      await facebookPagesFromCode(code, facebookRedirectUri(request.nextUrl.origin)),
      project?.name ?? "",
    );
    await db
      .delete(socialChannels)
      .where(and(eq(socialChannels.projectId, projectId), eq(socialChannels.platform, "facebook")));
    await db.insert(socialChannels).values({
      projectId,
      platform: "facebook",
      provider: "meta",
      accountId: page.id,
      accessToken: page.access_token,
      igUsername: page.name,
    });
    return back();
  } catch (e) {
    console.error("Facebook OAuth error:", e);
    return back(e instanceof Error ? e.message : "Facebook login failed");
  }
}
