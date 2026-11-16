import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialChannels } from "@/drizzle/schema";
import { zernioAccounts } from "@/lib/zernio";

// Zernio sends the browser back with connected=<platform>&accountId=..&username=..
// (or error=..). The account is checked against our own Zernio account list before
// it is stored, so a crafted link cannot point a channel elsewhere.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const projectId = q.get("projectId");
  const platform = q.get("platform");
  const base = (process.env.BASE_URL || request.nextUrl.origin).replace(/\/$/, "");
  const back = (error?: string) =>
    NextResponse.redirect(
      new URL(
        `/projects/${projectId}/social${error ? `?error=${encodeURIComponent(error)}` : ""}`,
        base,
      ),
    );
  if (!projectId || platform !== "tiktok")
    return NextResponse.redirect(new URL("/?error=missing_params", base));
  if (q.get("error"))
    return back(q.get("error_message") || q.get("error") || "Connection failed");
  const accountId = q.get("accountId");
  if (!accountId) return back("Zernio returned no account");
  try {
    const account = (await zernioAccounts()).find(
      (a) => a._id === accountId && a.platform === platform,
    );
    if (!account) return back("That account is not in our Zernio profile");
    await db
      .delete(socialChannels)
      .where(and(eq(socialChannels.projectId, projectId), eq(socialChannels.platform, platform)));
    await db.insert(socialChannels).values({
      projectId,
      platform,
      provider: "zernio",
      accountId,
      igUsername: account.username || account.displayName || q.get("username") || platform,
    });
    return back();
  } catch (e) {
    return back(e instanceof Error ? e.message : "Connection failed");
  }
}
