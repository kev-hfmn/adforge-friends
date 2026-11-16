// Facebook Page publishing, direct on our Meta app (Facebook Login, not Instagram Login).
// Keys: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET (App settings → Basic of the Meta app; the
// Instagram login uses a different, Instagram-specific app id). Page tokens taken from a
// long-lived user token do not expire.
const VERSION = "v27.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
].join(",");

async function graph<T>(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  const body = new URLSearchParams(params);
  const res = await fetch(
    method === "GET" ? `${GRAPH}${path}?${body}` : `${GRAPH}${path}`,
    method === "GET" ? undefined : { method, body },
  );
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || data.error)
    throw new Error(
      `Facebook: ${data.error?.error_user_msg || data.error?.message || res.status}`,
    );
  return data;
}

function app() {
  const id = process.env.FACEBOOK_APP_ID,
    secret = process.env.FACEBOOK_APP_SECRET;
  if (!id || !secret) throw new Error("FACEBOOK_APP_ID or FACEBOOK_APP_SECRET is not set");
  return { id, secret };
}

/** Must match the "Valid OAuth Redirect URIs" entry in the Meta app's Facebook Login settings. */
export function facebookRedirectUri(origin: string): string {
  return `${(process.env.BASE_URL || origin).replace(/\/$/, "")}/api/auth/facebook/callback`;
}

export function facebookLoginUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: app().id,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  });
  // Business-type apps use Facebook Login for Business: a saved configuration (the
  // permissions and Pages) replaces the scope list.
  const config = process.env.FACEBOOK_LOGIN_CONFIG_ID;
  if (config) params.set("config_id", config);
  else params.set("scope", FACEBOOK_SCOPES);
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params}`;
}

export type FacebookPage = { id: string; name: string; access_token: string };

/** Code → long-lived user token → the Pages it manages, each with a non-expiring token. */
export async function facebookPagesFromCode(
  code: string,
  redirectUri: string,
): Promise<FacebookPage[]> {
  const { id, secret } = app();
  const short = await graph<{ access_token: string }>(
    "/oauth/access_token",
    { client_id: id, client_secret: secret, redirect_uri: redirectUri, code },
    "GET",
  );
  const long = await graph<{ access_token: string }>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: short.access_token,
    },
    "GET",
  );
  const pages = await graph<{ data: FacebookPage[] }>(
    "/me/accounts",
    { fields: "id,name,access_token", access_token: long.access_token },
    "GET",
  );
  return pages.data ?? [];
}

/** Which Page to use: the only one, or the one whose name contains the project's name. */
export function choosePage(pages: FacebookPage[], brand: string): FacebookPage {
  if (pages.length === 1) return pages[0];
  const wanted = brand.trim().toLowerCase();
  const match = wanted ? pages.filter((p) => p.name.toLowerCase().includes(wanted)) : [];
  if (match.length === 1) return match[0];
  if (!pages.length)
    throw new Error("This Facebook login manages no Pages. Create a Facebook Page for this project first.");
  throw new Error(
    `Several Pages found (${pages.map((p) => p.name).join(", ")}). Give only one of them a name containing "${brand}", or log in with access to just that Page.`,
  );
}

/** The public link for a post or video id, once Facebook has one. */
export async function facebookPermalink(id: string, token: string): Promise<string | null> {
  const data = await graph<{ permalink_url?: string }>(
    `/${id}`,
    { fields: "permalink_url", access_token: token },
    "GET",
  );
  const url = data.permalink_url;
  if (!url) return null;
  return url.startsWith("http") ? url : `https://www.facebook.com${url}`;
}

export async function publishFacebookPhoto(
  pageId: string,
  token: string,
  url: string,
  message: string,
): Promise<string> {
  const res = await graph<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
    url,
    message,
    access_token: token,
  });
  return res.post_id ?? res.id;
}

export async function publishFacebookAlbum(
  pageId: string,
  token: string,
  urls: string[],
  message: string,
): Promise<string> {
  const ids: string[] = [];
  for (const url of urls) {
    const photo = await graph<{ id: string }>(`/${pageId}/photos`, {
      url,
      published: "false",
      access_token: token,
    });
    ids.push(photo.id);
  }
  const params: Record<string, string> = { message, access_token: token };
  ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const post = await graph<{ id: string }>(`/${pageId}/feed`, params);
  return post.id;
}

/** Reels: start a session, let Facebook pull the file from our URL, publish. Returns the video id. */
export async function publishFacebookReel(
  pageId: string,
  token: string,
  videoUrl: string,
  description: string,
): Promise<string> {
  const start = await graph<{ video_id: string }>(`/${pageId}/video_reels`, {
    upload_phase: "start",
    access_token: token,
  });
  const upload = await fetch(
    `https://rupload.facebook.com/video-upload/${VERSION}/${start.video_id}`,
    { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: videoUrl } },
  );
  const uploaded = (await upload.json().catch(() => ({}))) as {
    success?: boolean;
    debug_info?: { message?: string };
  };
  if (!upload.ok || !uploaded.success)
    throw new Error(`Facebook reel upload: ${uploaded.debug_info?.message || upload.status}`);
  await graph(`/${pageId}/video_reels`, {
    upload_phase: "finish",
    video_id: start.video_id,
    video_state: "PUBLISHED",
    description,
    access_token: token,
  });
  return start.video_id;
}

/**
 * Set the reel's thumbnail from our cover image. Without it Facebook takes the first
 * frame, which on our reels is often black by design (the story opens on the dark chart).
 */
export async function setFacebookThumbnail(
  videoId: string,
  token: string,
  imageUrl: string,
): Promise<void> {
  const image = await fetch(imageUrl);
  if (!image.ok) throw new Error(`Cover image ${image.status}: ${imageUrl}`);
  const form = new FormData();
  form.set("source", new Blob([await image.arrayBuffer()], { type: image.headers.get("content-type") || "image/jpeg" }), "cover.jpg");
  form.set("is_preferred", "true");
  form.set("access_token", token);
  const res = await fetch(`${GRAPH}/${videoId}/thumbnails`, { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok || data.error)
    throw new Error(`Facebook thumbnail: ${data.error?.message || res.status}`);
}

/** Reels process after publishing; "error" means it never went live. */
export async function facebookVideoState(
  videoId: string,
  token: string,
): Promise<"ready" | "processing" | "error"> {
  const data = await graph<{ status?: { video_status?: string } }>(
    `/${videoId}`,
    { fields: "status", access_token: token },
    "GET",
  );
  const s = data.status?.video_status;
  if (s === "ready") return "ready";
  if (s === "error" || s === "upload_failed" || s === "expired") return "error";
  return "processing";
}

const PAGE_INSIGHTS = [
  "page_follows",
  "page_impressions_unique",
  "page_media_view",
  "page_views_total",
  "page_post_engagements",
  "page_website_clicks",
] as const;

const POST_INSIGHTS = ["post_impressions_unique", "post_impressions", "post_clicks"] as const;

function insightNumber(payload: unknown): number | undefined {
  const data = payload != null && typeof payload === "object" ? (payload as { data?: unknown }).data : undefined;
  const row = Array.isArray(data) ? data[0] : undefined;
  if (row == null || typeof row !== "object") return undefined;
  const entry = row as {
    values?: { value?: unknown }[];
    total_value?: { value?: unknown };
  };
  const candidate = entry.total_value?.value ?? entry.values?.[0]?.value;
  return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : undefined;
}

/** Read-only. A blank token or a refused metric returns nothing and does not throw. */
async function readInsightMap(
  id: string,
  token: string,
  metrics: readonly string[],
  request: typeof fetch,
): Promise<Record<string, number>> {
  if (!id || !token) return {};
  const out: Record<string, number> = {};
  for (const metric of metrics) {
    try {
      const params = new URLSearchParams({ metric, period: "day", access_token: token });
      const response = await request(`${GRAPH}/${id}/insights?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || (data as { error?: unknown } | null)?.error) continue;
      const value = insightNumber(data);
      if (value != null) out[metric] = value;
    } catch {
      continue;
    }
  }
  return out;
}

export async function readFacebookPageDaily(
  pageId: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<Record<string, number>> {
  return readInsightMap(pageId, token, PAGE_INSIGHTS, request);
}

export async function readFacebookPostMetrics(
  postId: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<Record<string, number>> {
  return readInsightMap(postId, token, POST_INSIGHTS, request);
}
