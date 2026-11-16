import { NextRequest, NextResponse } from "next/server";
import ImageResponse from "@takumi-rs/image-response";
import React from "react";
import { AdTemplateTakumi, FEED_W, FEED_H } from "@/components/templates/AdTemplateTakumi";
import { ReelTemplateTakumi } from "@/components/templates/ReelTemplateTakumi";
import { readFile } from "fs/promises";
import { join } from "path";
import { getPalette, legacyPresetToPalette } from "@/lib/design-palettes";
import { renderPost, toAbsoluteUrl } from "@/lib/render";
import type { LayoutStyle } from "@/components/templates/AdTemplateTakumi";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Preview mode: render directly from props, no postId required
  if (body.preview === true) {
    const { templateType, layoutStyle, backgroundPreset, palette: paletteField, brandColor, ...contentProps } = body;
    const isReel = templateType === 'reel';
    const width = FEED_W;
    const height = isReel ? 1920 : FEED_H;
    const paletteId = paletteField ?? legacyPresetToPalette(backgroundPreset ?? "dark-gradient");
    const palette = getPalette(paletteId);
    const props = {
      headlineStart: contentProps.headlineStart ?? "Your message",
      headlineHighlight: contentProps.headlineHighlight ?? "right here",
      subtext: contentProps.subtext ?? "Supporting context that drives action.",
      boldPhrases: contentProps.boldPhrases ?? [],
      stats: contentProps.stats ?? [],
      socialProof: contentProps.socialProof ?? "",
      ctaText: contentProps.ctaText ?? "",
      palette,
      // Inline local /public paths as data URIs; Takumi can't fetch relative URLs
      backgroundImageUrl: toAbsoluteUrl(contentProps.backgroundImageUrl),
      brandColor: brandColor ?? '#6366f1',
      layoutStyle: (layoutStyle ?? 'bold-statement') as LayoutStyle,
      icon: contentProps.icon,
      bulletPoints: contentProps.bulletPoints,
      metricValue: contentProps.metricValue,
      metricUnit: contentProps.metricUnit,
      metricStatus: contentProps.metricStatus,
      progressPercent: contentProps.progressPercent,
    };
    const element = isReel
      ? React.createElement(ReelTemplateTakumi, props)
     : React.createElement(AdTemplateTakumi, props);
    return new ImageResponse(element, { width, height, format: 'png' });
  }

  // postId path: delegate to the canonical renderer (handles fal_full,
  // FAL backgrounds, logos; keep ONE render implementation)
  const { postId } = body;
  try {
    const publicPath = await renderPost(postId);
    return NextResponse.json({ path: publicPath, url: `${process.env.BASE_URL || "http://localhost:3000"}${publicPath}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    return NextResponse.json({ error: message }, { status: message === "Post not found" ? 404 : 500 });
  }
}

// Also support GET for direct image viewing: /api/render?postId=xxx
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });
  try {
    const publicPath = await renderPost(postId);
    const buffer = await readFile(join(process.cwd(), "public", publicPath.replace(/^\//, "")));
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "image/png" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    return NextResponse.json({ error: message }, { status: message === "Post not found" ? 404 : 500 });
  }
}
