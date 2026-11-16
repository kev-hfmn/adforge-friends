// Zernio (zernio.com, formerly getlate.dev): an audited posting service. We use it for
// TikTok and Facebook because TikTok does not approve posting apps that only serve
// their owner's accounts. Docs: https://docs.zernio.com. Key: ZERNIO_API_KEY.
const BASE = "https://zernio.com/api/v1";

export type ZernioPlatform = "tiktok" | "facebook";

function key(): string {
  const k = process.env.ZERNIO_API_KEY;
  if (!k) throw new Error("ZERNIO_API_KEY is not set");
  return k;
}

async function call<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text.slice(0, 300) };
  }
  if (!res.ok) {
    const err = (body ?? {}) as { error?: string; message?: string; code?: string };
    throw new Error(
      `Zernio ${res.status}: ${err.error || err.message || err.code || "request failed"}`,
    );
  }
  return { status: res.status, body: body as T };
}

/** The first (default) profile, created once if the account has none. */
export async function zernioProfileId(): Promise<string> {
  if (process.env.ZERNIO_PROFILE_ID) return process.env.ZERNIO_PROFILE_ID;
  const { body } = await call<{ profiles?: { _id: string }[] }>("/profiles");
  if (body.profiles?.[0]?._id) return body.profiles[0]._id;
  const created = await call<{ profile: { _id: string } }>("/profiles", {
    method: "POST",
    body: JSON.stringify({ name: "AdForge" }),
  });
  return created.body.profile._id;
}

export async function zernioConnectUrl(
  platform: ZernioPlatform,
  redirectUrl: string,
): Promise<string> {
  const params = new URLSearchParams({
    profileId: await zernioProfileId(),
    redirect_url: redirectUrl,
  });
  const { body } = await call<{ authUrl: string }>(
    `/connect/${platform}?${params}`,
  );
  if (!body.authUrl) throw new Error("Zernio returned no connect link");
  return body.authUrl;
}

export type ZernioAccount = {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
};
export async function zernioAccounts(): Promise<ZernioAccount[]> {
  const { body } = await call<{ accounts?: ZernioAccount[] }>("/accounts");
  return body.accounts ?? [];
}

export type ZernioMedia = { type: "image" | "video"; url: string };
export type ZernioPostRequest = {
  content: string;
  mediaItems: ZernioMedia[];
  platforms: {
    platform: ZernioPlatform;
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  }[];
  tiktokSettings?: Record<string, unknown>;
  publishNow: true;
};
export type ZernioPlatformResult = {
  platform?: string;
  status?: string;
  platformPostUrl?: string;
  errorMessage?: string;
  error?: string;
};
export type ZernioPost = {
  _id: string;
  status: string;
  platforms?: ZernioPlatformResult[];
};

export async function zernioPublish(
  request: ZernioPostRequest,
  idempotencyKey: string,
): Promise<ZernioPost> {
  const { body } = await call<{ post: ZernioPost }>("/posts", {
    method: "POST",
    body: JSON.stringify(request),
    idempotencyKey,
  });
  return body.post;
}

export async function zernioPost(id: string): Promise<ZernioPost> {
  const { body } = await call<{ post: ZernioPost }>(`/posts/${id}`);
  return body.post;
}
