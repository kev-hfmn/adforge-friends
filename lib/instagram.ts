const GRAPH = "https://graph.instagram.com/v19.0";

// Wait until a media container finishes processing (IG fetches the image async;
// publishing too early fails with "Media ID is not available").
async function waitForContainer(accessToken: string, containerId: string, maxSeconds = 60) {
  for (let i = 0; i < maxSeconds / 3; i++) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Media container failed with status: ${data.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Media container not ready after timeout");
}

export async function publishPhoto(accessToken: string, igUserId: string, imageUrl: string, caption: string) {
  // Step 1: Create media container
  const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  const createData = await createRes.json();
  if (createData.error) throw new Error(createData.error.message);

  // Step 2: Wait for IG to fetch/process the image, then publish
  await waitForContainer(accessToken, createData.id);
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);

  return publishData.id as string;
}

export async function publishCarousel(
  accessToken: string,
  igUserId: string,
  imageUrls: string[],
  caption: string
) {
  // Step 1: Create a container for each slide
  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const res = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: accessToken }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    childIds.push(data.id as string);
  }

  // Step 2: Create carousel container
  const carouselRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: accessToken,
    }),
  });
  const carouselData = await carouselRes.json();
  if (carouselData.error) throw new Error(carouselData.error.message);

  // Step 3: Wait for processing, then publish
  await waitForContainer(accessToken, carouselData.id);
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);
  return publishData.id as string;
}

export async function publishReel(
  accessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string
) {
  // Step 1: Create container with media_type=REELS
  const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: videoUrl,
      caption,
      media_type: "REELS",
      ...(coverUrl ? { cover_url: coverUrl } : {}),
      access_token: accessToken,
    }),
  });
  const createData = await createRes.json();
  if (createData.error) throw new Error(createData.error.message);

  const containerId = createData.id as string;

  // Step 2: Poll status until FINISHED (once/min, max 5 min per Instagram docs)
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 60_000));
    const statusRes = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
      throw new Error(`Reel container failed with status: ${statusData.status_code}`);
    }
  }

  // Step 3: Publish
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(publishData.error.message);

  return publishData.id as string;
}

export async function refreshToken(accessToken: string) {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH}/refresh_access_token?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data as { access_token: string; token_type: string; expires_in: number };
}

// Dependency injection keeps API behavior verifiable with local typed fixtures.
export async function fetchMediaInsights(accessToken: string, mediaId: string, request: typeof fetch = fetch) {
  const { parseMediaInsights, insightsPermissionError } = await import("./queue-insights");
  const get = async (metrics: string) => {
    const params = new URLSearchParams({ metric: metrics, access_token: accessToken });
    const response = await request(`${GRAPH}/${mediaId}/insights?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (data.error || !response.ok) {
      const error = new Error(data.error?.message ?? `Insights failed (${response.status})`);
      Object.assign(error, { permissionError: insightsPermissionError(data.error ?? {}) });
      throw error;
    }
    return parseMediaInsights(data);
  };
  try { return await get("reach,likes,comments,saved,shares,total_interactions,views"); }
  catch (error) {
    if ((error as Error & { permissionError?: boolean }).permissionError) throw error;
    return get("reach,saved");
  }
}

export async function fetchAccountStats(accessToken: string, request: typeof fetch = fetch) {
  const { parseAccountStats, insightsPermissionError } = await import("./queue-insights");
  const params = new URLSearchParams({ fields: "followers_count,media_count", access_token: accessToken });
  const response = await request(`${GRAPH}/me?${params}`, { cache: "no-store" });
  const data = await response.json();
  if (data.error || !response.ok) {
    const error = new Error(data.error?.message ?? `Account stats failed (${response.status})`);
    Object.assign(error, { permissionError: insightsPermissionError(data.error ?? {}) });
    throw error;
  }
  return parseAccountStats(data);
}

export async function fetchPermalink(accessToken: string, mediaId: string, request: typeof fetch = fetch): Promise<string | null> {
  // A published post stays published even when this optional lookup fails.
  try {
    const params = new URLSearchParams({ fields: "permalink", access_token: accessToken });
    const response = await request(`${GRAPH}/${mediaId}?${params}`, { cache: "no-store" });
    const data = await response.json();
    return response.ok && !data.error && typeof data.permalink === "string" ? data.permalink : null;
  } catch { return null; }
}
