"use server";

import { generateAdContent, generateCarouselContent, recreateViralContent, GeneratedAdContent, CarouselSlide, TargetingContext, ContentIdea, generateContentIdeas, autoGeneratePost, ProjectPostResult } from "@/lib/anthropic";
import { CAROUSEL_FRAMEWORKS } from "@/lib/carousel-frameworks";
import { db } from "@/lib/db";
import { generatedPosts, generationLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateBrandFal } from "@/lib/fal";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { renderPost, renderCarousel } from "@/lib/render";
import { projects } from "@/drizzle/schema";

export interface GenerateResult {
  success: boolean;
  data?: GeneratedAdContent & { backgroundImageUrl?: string; imageMode?: string; imagePrompt?: string };
  postId?: string;
  error?: string;
}

/** Run FAL for a generated result when its imageMode asks for an AI image. */
async function maybeGenerateFal(
  projectId: string,
  result: ProjectPostResult,
  fileStem: string,
  aspectRatio: "1:1" | "4:5" | "9:16" = "4:5"
): Promise<{ backgroundImageUrl: string | null; falSourceUrl: string | null }> {
  if ((result.imageMode !== "fal_background" && result.imageMode !== "fal_full") || !result.imagePrompt) {
    return { backgroundImageUrl: null, falSourceUrl: null };
  }
  const fal = await generateBrandFal(result.imagePrompt, result.imageMode, fileStem, projectId, aspectRatio);
  return { backgroundImageUrl: fal.publicPath, falSourceUrl: fal.sourceUrl };
}

export async function generateAction(
  projectId: string,
  prompt: string,
  templateType: "ad" | "reel",
  layoutStyle: string = 'bold-statement',
  targetingContext?: TargetingContext
): Promise<GenerateResult> {
  const startTime = Date.now();

  try {
    const data = await generateAdContent(projectId, prompt, templateType, targetingContext);
    // Brand-kit-locked FAL background so the preview shows the real look
    const { backgroundImageUrl } = await maybeGenerateFal(projectId, data, `gen_${uuidv4()}`, templateType === "reel" ? "9:16" : "4:5");

    await db.insert(generationLogs).values({
      id: uuidv4(),
      projectId,
      type: "manual",
      prompt,
      response: JSON.stringify(data),
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    });

    return { success: true, data: { ...data, backgroundImageUrl: backgroundImageUrl ?? undefined } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";

    await db.insert(generationLogs).values({
      id: uuidv4(),
      projectId,
      type: "manual",
      prompt,
      response: JSON.stringify({ error: message }),
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      error: message,
    });

    return { success: false, error: message };
  }
}

type PostData = {
  headlineStart: string;
  headlineHighlight: string;
  subtext: string;
  boldPhrases: string[];
  caption: string;
  hashtags: string;
  backgroundPreset: string;
  backgroundImageUrl?: string;
  stats: { label: string; value: string; change?: string }[];
  socialProof: string;
  ctaText: string;
  layoutStyle?: string;
  targetingContext?: TargetingContext;
  paletteId?: string;         // NEW — palette ID from user's picker selection
  imageMode?: string;         // template | fal_background | fal_full
  imagePrompt?: string;
};

export async function savePost(
  projectId: string,
  templateType: "ad" | "reel",
  data: PostData
): Promise<string> {
  const postId = uuidv4();

  await db.insert(generatedPosts).values({
    id: postId,
    projectId,
    status: "pending",
    templateType,
    headline: data.headlineStart,
    headlineHighlight: data.headlineHighlight,
    subtext: data.subtext,
    boldPhrases: JSON.stringify(data.boldPhrases),
    caption: data.caption,
    hashtags: data.hashtags,
    backgroundPreset: data.backgroundPreset,
    backgroundImageUrl: data.backgroundImageUrl ?? null,
    layoutStyle: data.layoutStyle,
    palette: data.paletteId ?? null,
    imageMode: data.imageMode ?? null,
    imagePrompt: data.imagePrompt ?? null,
    metadata: JSON.stringify({
      stats: data.stats,
      socialProof: data.socialProof,
      ctaText: data.ctaText,
    }),
    targetingContext: data.targetingContext ? JSON.stringify(data.targetingContext) : null,
    source: "manual",
  });

  await renderPost(postId);
  revalidatePath(`/projects/${projectId}/queue`);
  return postId;
}

export async function updatePost(
  postId: string,
  projectId: string,
  templateType: "ad" | "reel",
  data: PostData
): Promise<void> {
  await db
    .update(generatedPosts)
    .set({
      templateType,
      headline: data.headlineStart,
      headlineHighlight: data.headlineHighlight,
      subtext: data.subtext,
      boldPhrases: JSON.stringify(data.boldPhrases),
      caption: data.caption,
      hashtags: data.hashtags,
      backgroundPreset: data.backgroundPreset,
      backgroundImageUrl: data.backgroundImageUrl ?? null,
      layoutStyle: data.layoutStyle,
      palette: data.paletteId ?? null,
      imageMode: data.imageMode ?? null,
      imagePrompt: data.imagePrompt ?? null,
      metadata: JSON.stringify({
        stats: data.stats,
        socialProof: data.socialProof,
        ctaText: data.ctaText,
      }),
      targetingContext: data.targetingContext ? JSON.stringify(data.targetingContext) : null,
      // Re-render clears old image; render will set a fresh one
      imagePath: null,
    })
    .where(eq(generatedPosts.id, postId));

  await renderPost(postId);
  revalidatePath(`/projects/${projectId}/queue`);
  revalidatePath(`/projects/${projectId}/generate`);
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

export interface GenerateCarouselResult {
  success: boolean;
  slides?: CarouselSlide[];
  caption?: string;
  hashtags?: string;
  error?: string;
  detectedFramework?: string;  // from viral mode
  layoutStyle?: string;        // AI-selected
  paletteId?: string;          // AI-selected
  imageMode?: string;          // AI-selected — "fal_full" means each slide IS a finished AI image, no Takumi overlay
}

export async function generateCarouselAction(
  projectId: string,
  prompt: string,
  frameworkId?: string,
  slideCount?: number,
  targetingContext?: TargetingContext
): Promise<GenerateCarouselResult> {
  try {
    const result = await generateCarouselContent(projectId, prompt, frameworkId, slideCount, targetingContext);

    // Brand-kit-locked FAL image per slide (skipped for template-only brands).
    // fal_full: the AI image IS the slide (no Takumi text overlay). fal_background: AI scene behind Takumi type.
    let slides = result.slides;
    if (result.imageMode !== "template") {
      const stem = uuidv4();
      slides = await Promise.all(
        result.slides.map(async (s, i) => {
          if (!s.imagePrompt) return s;
          const fal = await generateBrandFal(s.imagePrompt, result.imageMode, `car_${stem}_s${i}`, projectId, "4:5");
          return { ...s, backgroundImageUrl: fal.publicPath };
        })
      );
    }

    return {
      success: true,
      slides,
      caption: result.caption,
      hashtags: result.hashtags,
      layoutStyle: result.layoutStyle,
      paletteId: result.paletteId,
      imageMode: result.imageMode,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Generation failed" };
  }
}

/** Manual per-slide AI redesign: lets the AI own the whole slide (art + baked-in
 * text), optionally using an uploaded photo as reference. Opt-in per slide so a
 * bad result never overwrites the working Takumi overlay without the user seeing it first. */
export async function generateSlideAiImage(
  projectId: string,
  prompt: string,
  referenceImageUrl?: string
): Promise<{ url: string } | { error: string }> {
  try {
    const { applyImageStyleLock } = await import("@/lib/brand-kit");
    const locked = await applyImageStyleLock(projectId, prompt, "fal_full");
    const stem = `slide_ai_${uuidv4()}`;
    if (referenceImageUrl) {
      const { editFalImage } = await import("@/lib/fal");
      const { toAbsoluteUrl } = await import("@/lib/render");
      const ref = toAbsoluteUrl(referenceImageUrl);
      if (!ref) return { error: "Reference image not found" };
      const result = await editFalImage(locked, [ref], stem);
      return { url: result.publicPath };
    }
    const { generateFalImage } = await import("@/lib/fal");
    const result = await generateFalImage(locked, "4:5", stem);
    return { url: result.publicPath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed" };
  }
}

export async function recreateViralAction(
  projectId: string,
  viralInput: { text?: string; imageBase64?: string; imageMimeType?: string },
  outputType: "ad" | "reel" | "carousel",
  frameworkId?: string,
  slideCount?: number,
  layoutStyle?: string,
  targetingContext?: TargetingContext,
  paletteId?: string
): Promise<GenerateResult | GenerateCarouselResult> {
  const startTime = Date.now();
  try {
    const result = await recreateViralContent(projectId, viralInput, outputType, frameworkId, slideCount, targetingContext);

    if (result.type === "carousel") {
      return {
        success: true,
        slides: result.slides,
        caption: result.caption,
        hashtags: result.hashtags,
        detectedFramework: result.detectedFramework,
        layoutStyle: result.layoutStyle,
        paletteId: result.paletteId,
      } as GenerateCarouselResult;
    } else {
      // Save feed/reel post immediately (same pattern as generateAction)
      const postId = uuidv4();
      // Use AI-returned layoutStyle unless user explicitly provided one
      const finalLayoutStyle = layoutStyle ?? result.layoutStyle;
      // Use AI-returned paletteId unless user explicitly provided one
      const finalPaletteId = paletteId ?? result.paletteId;

      await db.insert(generatedPosts).values({
        id: postId,
        projectId,
        status: "draft",
        templateType: outputType,
        headline: result.headlineStart,
        headlineHighlight: result.headlineHighlight,
        subtext: result.subtext,
        boldPhrases: JSON.stringify(result.boldPhrases),
        caption: result.caption,
        hashtags: result.hashtags,
        backgroundPreset: result.backgroundPreset,
        layoutStyle: finalLayoutStyle,
        palette: finalPaletteId,
        metadata: JSON.stringify({
          stats: result.stats,
          socialProof: result.socialProof,
          ctaText: result.ctaText,
        }),
        targetingContext: targetingContext ? JSON.stringify(targetingContext) : null,
        source: "viral",
      });

      await db.insert(generationLogs).values({
        id: uuidv4(),
        projectId,
        postId,
        prompt: viralInput.text ?? "[image input]",
        durationMs: Date.now() - startTime,
      });

      await renderPost(postId);
      revalidatePath(`/projects/${projectId}`);

      return { success: true, data: result as unknown as GeneratedAdContent, postId };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to recreate viral content" };
  }
}

export async function saveCarouselPost(
  projectId: string,
  slides: CarouselSlide[],
  caption: string,
  hashtags: string,
  targetingContext?: TargetingContext,
  paletteId?: string,                    // NEW
  imageMode?: string,                    // "fal_full" skips the Takumi text overlay entirely
  layoutStyle?: string                   // renderCarousel reads this back from the DB
): Promise<string> {
  const postId = uuidv4();

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const brandColor = project?.brandColor ?? "#6366f1";

  await db.insert(generatedPosts).values({
    id: postId,
    projectId,
    status: "pending",
    templateType: "carousel",
    headline: slides[0]?.headlineStart ?? "",
    headlineHighlight: slides[0]?.headlineHighlight ?? "",
    subtext: slides[0]?.subtext ?? "",
    caption,
    hashtags,
    backgroundPreset: slides[0]?.backgroundPreset ?? "dark-gradient",
    carouselSlides: JSON.stringify(slides),
    targetingContext: targetingContext ? JSON.stringify(targetingContext) : null,
    palette: paletteId ?? null,
    imageMode: imageMode ?? null,
    layoutStyle: layoutStyle ?? null,
    source: "manual",
  });

  await renderCarousel(postId, slides, brandColor, project?.logoPath ? `${process.env.BASE_URL || "http://localhost:3000"}${project.logoPath}` : undefined, paletteId);
  revalidatePath(`/projects/${projectId}/queue`);
  return postId;
}

export async function updateCarouselPost(
  postId: string,
  projectId: string,
  slides: CarouselSlide[],
  caption: string,
  hashtags: string,
  targetingContext?: TargetingContext,
  paletteId?: string,
  imageMode?: string,
  layoutStyle?: string
): Promise<void> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const brandColor = project?.brandColor ?? "#6366f1";

  // Persist imageMode (and the rest) first — renderCarousel reads post.imageMode from the DB
  // to decide whether to skip the Takumi text overlay for fal_full slides.
  await db
    .update(generatedPosts)
    .set({
      headline: slides[0]?.headlineStart ?? "",
      headlineHighlight: slides[0]?.headlineHighlight ?? "",
      subtext: slides[0]?.subtext ?? "",
      caption,
      hashtags,
      backgroundPreset: slides[0]?.backgroundPreset ?? "dark-gradient",
      carouselSlides: JSON.stringify(slides),
      targetingContext: targetingContext ? JSON.stringify(targetingContext) : null,
      palette: paletteId ?? null,
      imageMode: imageMode ?? null,
      layoutStyle: layoutStyle ?? null,
    })
    .where(eq(generatedPosts.id, postId));

  await renderCarousel(postId, slides, brandColor, project?.logoPath ? `${process.env.BASE_URL || "http://localhost:3000"}${project.logoPath}` : undefined, paletteId);
  revalidatePath(`/projects/${projectId}/queue`);
  revalidatePath(`/projects/${projectId}/generate`);
}

// ─── Content Ideas ──────────────────────────────────────────────────────────

export interface ContentIdeasResult {
  success: boolean;
  ideas?: ContentIdea[];
  error?: string;
}

export async function contentIdeasAction(
  projectId: string,
  targetingContext?: TargetingContext
): Promise<ContentIdeasResult> {
  try {
    const ideas = await generateContentIdeas(projectId, targetingContext);
    return { success: true, ideas };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate ideas" };
  }
}

// ─── Auto-Generate ──────────────────────────────────────────────────────────

export async function autoGenerateAction(
  projectId: string,
  templateType: "ad" | "reel",
  layoutStyle: string = "bold-statement",
  targetingContext?: TargetingContext,
  paletteId?: string
): Promise<GenerateResult> {
  const startTime = Date.now();
  try {
    const data = await autoGeneratePost(projectId, templateType, targetingContext);
    const { backgroundImageUrl } = await maybeGenerateFal(projectId, data, `gen_${uuidv4()}`);

    await db.insert(generationLogs).values({
      id: uuidv4(),
      projectId,
      type: "manual",
      prompt: "[auto-generated from KB]",
      response: JSON.stringify(data),
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
    });

    return { success: true, data: { ...data, backgroundImageUrl: backgroundImageUrl ?? undefined } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-generation failed";
    return { success: false, error: message };
  }
}

// ─── Generate Week ──────────────────────────────────────────────────────────

export interface GenerateWeekResult {
  success: boolean;
  postCount?: number;
  error?: string;
}

export async function generateWeekAction(
  projectId: string,
  targetingContext?: TargetingContext,
  paletteId?: string
): Promise<GenerateWeekResult> {
  try {
    // Generate content ideas to get a varied plan
    const ideas = await generateContentIdeas(projectId, targetingContext);
    // Take 5-7 ideas (generateContentIdeas returns up to 6, pad if needed)
    const plan = ideas.slice(0, 7);
    if (plan.length < 5) {
      // If fewer than 5 ideas, duplicate with different types
      while (plan.length < 5) {
        plan.push({ ...plan[plan.length - 1], title: plan[plan.length - 1].title + " (variation)" });
      }
    }

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    const brandColor = project?.brandColor ?? "#6366f1";

    let savedCount = 0;

    for (const idea of plan) {
      try {
        if (idea.postType === "carousel") {
          const frameworkId = idea.framework || "pattern-interrupt";
          const fw = CAROUSEL_FRAMEWORKS.find((f) => f.id === frameworkId);
          const slideCount = fw?.defaultSlideCount ?? 5;

          const result = await generateCarouselContent(
            projectId,
            idea.title,
            frameworkId,
            slideCount,
            targetingContext
          );

          const postId = uuidv4();
          await db.insert(generatedPosts).values({
            id: postId,
            projectId,
            status: "pending",
            templateType: "carousel",
            headline: result.slides[0]?.headlineStart ?? "",
            headlineHighlight: result.slides[0]?.headlineHighlight ?? "",
            subtext: result.slides[0]?.subtext ?? "",
            caption: result.caption,
            hashtags: result.hashtags,
            backgroundPreset: result.slides[0]?.backgroundPreset ?? "dark-gradient",
            carouselSlides: JSON.stringify(result.slides),
            targetingContext: targetingContext ? JSON.stringify(targetingContext) : null,
            palette: paletteId ?? null,
            layoutStyle: result.layoutStyle,
            source: "bulk",
          });

          // Render carousel PNGs
          await renderCarousel(
            postId,
            result.slides,
            brandColor,
            project?.logoPath ? `${process.env.BASE_URL || "http://localhost:3000"}${project.logoPath}` : undefined,
            result.paletteId
          );
        } else {
          // ad or reel
          const data = await generateAdContent(
            projectId,
            idea.title,
            idea.postType as "ad" | "reel",
            targetingContext
          );

          const postId = uuidv4();
          await db.insert(generatedPosts).values({
            id: postId,
            projectId,
            status: "pending",
            templateType: idea.postType,
            headline: data.headlineStart,
            headlineHighlight: data.headlineHighlight,
            subtext: data.subtext,
            boldPhrases: JSON.stringify(data.boldPhrases),
            caption: data.caption,
            hashtags: data.hashtags,
            backgroundPreset: data.backgroundPreset,
            layoutStyle: "bold-statement",
            palette: paletteId ?? null,
            metadata: JSON.stringify({
              stats: data.stats,
              socialProof: data.socialProof,
              ctaText: data.ctaText,
            }),
            targetingContext: targetingContext ? JSON.stringify(targetingContext) : null,
            source: "bulk",
          });

          // Render PNG
          await renderPost(postId);
        }

        savedCount++;
      } catch (err) {
        // Log individual post failure but continue with remaining posts
        console.error(`Generate Week: failed to create post for "${idea.title}":`, err);
      }
    }

    revalidatePath(`/projects/${projectId}/queue`);
    return { success: true, postCount: savedCount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Generate Week failed",
    };
  }
}
