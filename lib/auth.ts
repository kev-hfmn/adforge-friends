// Single-password gate for AdForge. The session cookie holds an HMAC of the
// password, so changing ADFORGE_PASSWORD logs every device out.
// Web Crypto only: this file is imported by proxy.ts as well as server actions.

export const SESSION_COOKIE = "adforge_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("adforge-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.ADFORGE_PASSWORD;
  if (!password || !cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(password));
}

// Only same-site paths, so ?next= can't bounce someone to another domain.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

// Signed OAuth state, so the Instagram callback can stay outside the password
// gate (Instagram returns to the ngrok host, which may not hold the session
// cookie) without letting a stranger attach their own account to a project.
const STATE_TTL_MS = 15 * 60 * 1000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signOAuthState(projectId: string): Promise<string> {
  const password = process.env.ADFORGE_PASSWORD;
  if (!password) throw new Error("ADFORGE_PASSWORD is not set");
  const exp = Date.now() + STATE_TTL_MS;
  return `${projectId}.${exp}.${await hmacHex(password, `ig-oauth|${projectId}|${exp}`)}`;
}

// Returns the projectId if the state is ours and fresh, else null.
export async function verifyOAuthState(state: string | null): Promise<string | null> {
  const password = process.env.ADFORGE_PASSWORD;
  if (!password || !state) return null;
  const [projectId, expStr, sig] = state.split(".");
  const exp = Number(expStr);
  if (!projectId || !sig || !Number.isFinite(exp) || Date.now() > exp) return null;
  const expected = await hmacHex(password, `ig-oauth|${projectId}|${exp}`);
  return safeEqual(sig, expected) ? projectId : null;
}
