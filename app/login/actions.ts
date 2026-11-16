"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, safeNext, sessionToken } from "@/lib/auth";

// Small in-memory brake on guessing: 5 wrong tries per IP per 10 minutes.
const failures = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const now = Date.now();
  const entry = failures.get(ip);
  if (entry && now - entry.since < WINDOW_MS && entry.count >= MAX_FAILS) {
    return "Too many tries. Wait 10 minutes.";
  }

  const expected = process.env.ADFORGE_PASSWORD;
  if (!expected) return "ADFORGE_PASSWORD is not set on the server.";

  const given = String(formData.get("password") ?? "");
  if (!safeEqual(await sessionToken(given), await sessionToken(expected))) {
    const fresh = !entry || now - entry.since >= WINDOW_MS;
    failures.set(ip, fresh ? { count: 1, since: now } : { count: entry.count + 1, since: entry.since });
    return "Wrong password.";
  }

  failures.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: h.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
