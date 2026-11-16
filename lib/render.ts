import { join } from "path";
import { mkdir } from "fs/promises";
import { readFileSync } from "fs";
import React from "react";
import { AdTemplateTakumi, type LayoutStyle, FEED_W, FEED_H } from "@/components/templates/AdTemplateTakumi";
import { ReelTemplateTakumi } from "@/components/templates/ReelTemplateTakumi";
import { renderImage as renderElement } from "@/lib/render-image";
import { db } from "@/lib/db";
import { generatedPosts, projects } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { CarouselSlide } from "@/lib/anthropic";
import { getPalette, legacyPresetToPalette } from "@/lib/design-palettes";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Resolve an image reference for Satori/Takumi. Local /public files are inlined
// as data URIs so rendering never depends on BASE_URL / the tunnel being reachable.
export function toAbsoluteUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  try {
    const buf = readFileSync(join(process.cwd(), "public", path.replace(/^\//, "")));
    const ext = path.split(".").pop()?.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return `${BASE_URL}${path}`;
  }
}

export async function renderPost(postId: string): Promise<string> {
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
  });
  if (!post) throw new Error(`Post ${postId} not found`);

  // If imageMode is fal_full, the FAL image IS the post; no Takumi render needed.
  if (post.imageMode === "fal_full" && post.backgroundImageUrl) {
    await db.update(generatedPosts).set({ imagePath: post.backgroundImageUrl }).where(eq(generatedPosts.id, postId));
    return post.backgroundImageUrl;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, post.projectId!),
  });
  const brandColor = project?.brandColor ?? "#6366f1";

  const resolvedPaletteId = post.palette ?? legacyPresetToPalette(post.backgroundPreset ?? "dark-gradient");
  const palette = getPalette(resolvedPaletteId);

  let metadata: { stats?: { label: string; value: string; change?: string }[]; socialProof?: string; ctaText?: string } = {};
  try { metadata = JSON.parse(post.metadata || "{}"); } catch {}
  let boldPhrases: string[] = [];
  try { boldPhrases = JSON.parse(post.boldPhrases || "[]"); } catch {}

  const props = {
    headlineStart: post.headline || "",
    headlineHighlight: post.headlineHighlight || "",
    subtext: post.subtext || "",
    boldPhrases,
    palette,
    stats: metadata.stats || [],
    socialProof: metadata.socialProof || "",
    ctaText: metadata.ctaText || "",
    brandColor,
    layoutStyle: (post.layoutStyle ?? "bold-statement") as LayoutStyle,
    backgroundImageUrl: toAbsoluteUrl(post.backgroundImageUrl),
    logoUrl: toAbsoluteUrl(project?.logoPath),
  };

  const isReel = post.templateType === "reel";
  const width = FEED_W;
  const height = isReel ? 1920 : FEED_H;

  const element = isReel
    ? React.createElement(ReelTemplateTakumi, props)
   : React.createElement(AdTemplateTakumi, props);

  const dir = join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${postId}.png`);
  await renderElement(element, width, height, filePath);

  const publicPath = `/generated/${postId}.png`;

  await db
    .update(generatedPosts)
    .set({ imagePath: publicPath })
    .where(eq(generatedPosts.id, postId));

  return publicPath;
}

export async function renderCarousel(
  postId: string,
  slides: CarouselSlide[],
  brandColor: string,
  logoUrl?: string,
  postPaletteId?: string
): Promise<CarouselSlide[]> {
  const dir = join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });

  // Slides inherit the post-level layoutStyle (e.g. editorial-lower over FAL slides).
  const post = await db.query.generatedPosts.findFirst({
    where: eq(generatedPosts.id, postId),
    columns: { projectId: true, layoutStyle: true, imageMode: true },
  });
  const slideLayout = (post?.layoutStyle ?? "bold-statement") as LayoutStyle;
  // Resolve once here: callers pass either a BASE_URL-prefixed URL or a raw
  // /uploads path, and Takumi can only read absolute URLs or data URIs.
  const resolvedLogoUrl = toAbsoluteUrl(logoUrl);
  // fal_full: that slide's AI image IS the finished slide; no Takumi text overlay.
  // Per-slide override wins (manual "AI redesign" opt-in); else falls back to the post-level mode.
  const isPostFalFull = post?.imageMode === "fal_full";

  const rendered: CarouselSlide[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const isFalFull = slide.imageMode === "fal_full" || (slide.imageMode == null && isPostFalFull);
    if (isFalFull && slide.backgroundImageUrl) {
      rendered.push({ ...slide, imagePath: slide.backgroundImageUrl });
      continue;
    }
    // Resolution chain: per-slide override > post-level palette > legacy backgroundPreset fallback
    const slidePaletteId = slide.paletteId
      ?? postPaletteId
      ?? legacyPresetToPalette(slide.backgroundPreset || "dark-gradient");
    const palette = getPalette(slidePaletteId);
    const props = {
      headlineStart: slide.headlineStart,
      headlineHighlight: slide.headlineHighlight,
      subtext: slide.subtext,
      boldPhrases: [],
      palette,
      stats: [],
      socialProof: "",
      ctaText: slide.ctaText || "",
      brandColor,
      layoutStyle: slideLayout,
      logoUrl: resolvedLogoUrl, // watermark every slide; carousels get reshared out of order
      backgroundImageUrl: toAbsoluteUrl(slide.backgroundImageUrl),
    };

    const element = React.createElement(AdTemplateTakumi, props);
    const filePath = join(dir, `${postId}_slide_${i}.png`);
    await renderElement(element, FEED_W, FEED_H, filePath);

    rendered.push({ ...slide, imagePath: `/generated/${postId}_slide_${i}.png` });
  }

  // Store all slide data (with imagePaths) back to DB
  await db
    .update(generatedPosts)
    .set({
      imagePath: rendered[0].imagePath, // first slide as thumbnail
      carouselSlides: JSON.stringify(rendered),
    })
    .where(eq(generatedPosts.id, postId));

  return rendered;
}
