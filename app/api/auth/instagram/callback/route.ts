import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { socialChannels } from "@/drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import { verifyOAuthState } from "@/lib/auth";

async function exchangeCodeForShortToken(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const data = await res.json();
  if (data.error_type || data.error) throw new Error(data.error_message || data.error?.message || "Token exchange failed");
  return data as { access_token: string; user_id: number };
}

async function exchangeForLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.META_APP_SECRET!,
    access_token: shortToken,
  });

  const res = await fetch(`https://graph.instagram.com/access_token?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data as { access_token: string; token_type: string; expires_in: number };
}

async function getIgProfile(accessToken: string) {
  // /me resolves the token owner; the raw user_id from the token exchange is an
  // app-scoped ID that graph.instagram.com cannot load directly. The `user_id`
  // field in the response is the real IG professional account ID (used for publishing).
  const res = await fetch(
    `https://graph.instagram.com/v19.0/me?fields=user_id,username,account_type&access_token=${accessToken}`
  );
  const data = await res.json();
  console.log("Profile response:", JSON.stringify(data));
  if (data.error) throw new Error(data.error.message);
  return data as { id: string; user_id?: string; username: string; account_type: string };
}

export async function GET(request: NextRequest) {
  // request.url carries the custom server's bind address (0.0.0.0:3010), not
  // the tunnel host, so redirects are built from BASE_URL.
  const origin = process.env.BASE_URL || request.nextUrl.origin;
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  // This route is outside the password gate (see proxy.ts), so the signed
  // state is what proves the Connect click came from inside AdForge.
  const projectId = await verifyOAuthState(searchParams.get("state"));
  const igError = searchParams.get("error");
  const igErrorReason = searchParams.get("error_reason");
  const igErrorDesc = searchParams.get("error_description");

  console.log("OAuth callback params:", { code: !!code, projectId, igError, igErrorReason, igErrorDesc });

  if (!projectId) {
    return NextResponse.redirect(new URL("/?error=oauth_state_invalid_or_expired", origin));
  }

  // Instagram returned an error
  if (igError) {
    const msg = igErrorDesc || igErrorReason || igError;
    console.error("Instagram OAuth error:", msg);
    return NextResponse.redirect(
      new URL(`/projects/${projectId}/social?error=${encodeURIComponent(msg)}`, origin)
    );
  }

  if (!code || !projectId) {
    return NextResponse.redirect(new URL("/?error=missing_params", origin));
  }

  try {
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

    const shortToken = await exchangeCodeForShortToken(code, redirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const profile = await getIgProfile(longToken.access_token);

    const existing = await db.query.socialChannels.findFirst({
      where: and(eq(socialChannels.projectId, projectId), eq(socialChannels.platform, "instagram")),
    });
    if (existing) await db.delete(socialChannels).where(eq(socialChannels.id, existing.id));

    await db.insert(socialChannels).values({
      id: uuidv4(),
      projectId,
      platform: "instagram",
      accessToken: longToken.access_token,
      igUserId: String(profile.user_id ?? profile.id),
      igUsername: profile.username,
      tokenExpiresAt: Date.now() + longToken.expires_in * 1000,
    });

    return NextResponse.redirect(new URL(`/projects/${projectId}/social`, origin));
  } catch (error) {
    console.error("Instagram OAuth error:", error);
    const msg = error instanceof Error ? error.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/projects/${projectId}/social?error=${encodeURIComponent(msg)}`, origin)
    );
  }
}
