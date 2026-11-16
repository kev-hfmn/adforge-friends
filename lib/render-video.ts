import { join } from "path";
import { mkdir } from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { db } from "@/lib/db";
import { generatedPosts, projects } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// Cache the bundle URL across renders (expensive to rebuild each time)
let bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  bundleCache = await bundle({
    entryPoint: join(process.cwd(), "src", "remotion", "index.tsx"),
  });
  return bundleCache;
}

export async function renderVideoPost(postId: string): Promise<string> {
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post) throw new Error(`Post ${postId} not found`);

  let metadata: {
    stats?: { label: string; value: string; change?: string }[];
    socialProof?: string;
    ctaText?: string;
  } = {};
  try { metadata = JSON.parse(post.metadata || "{}"); } catch {}

  const project = post.projectId
    ? await db.query.projects.findFirst({ where: eq(projects.id, post.projectId), columns: { brandColor: true } })
    : null;
  const compositionId = "AdReel";
  const inputProps: Record<string, unknown> = {
    headlineStart: post.headline || "",
    headlineHighlight: post.headlineHighlight || "",
    subtext: post.subtext || "",
    boldPhrases: [] as string[],
    backgroundPreset: (post.backgroundPreset || "dark-gradient") as "dark-gradient",
    stats: metadata.stats || [],
    socialProof: metadata.socialProof || "",
    ctaText: metadata.ctaText || "",
    brandColor: project?.brandColor ?? "#6366f1",
  };

  const dir = join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const filename = `${postId}.mp4`;
  const outputLocation = join(dir, filename);

  const serveUrl = await getBundle();

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
  });

  const publicPath = `/generated/${filename}`;

  await db
    .update(generatedPosts)
    .set({ videoPath: publicPath })
    .where(eq(generatedPosts.id, postId));

  return publicPath;
}
