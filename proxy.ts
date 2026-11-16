import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Everything needs the AdForge password except:
// - the login page itself
// - media Instagram/Meta must fetch from BASE_URL (rendered posts, uploads)
// - endpoints that check their own secret (cron, Instagram and Facebook OAuth callbacks)
const PUBLIC_PREFIXES = [
  "/login",
  "/generated/",
  "/uploads/",
  "/api/cron/",
  "/api/auth/instagram/callback", // checks its own signed state (lib/auth.ts)
  "/api/auth/facebook/callback", // same signed state
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (!process.env.ADFORGE_PASSWORD) {
    // Fail closed: an unset password must not mean an open queue.
    return new NextResponse("ADFORGE_PASSWORD is not set on the server.", { status: 503 });
  }

  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and root-level static files (favicon etc.).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
