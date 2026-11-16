"use client";

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TemplatePicker } from "./TemplatePicker";
import { generateAction, savePost, updatePost, generateCarouselAction, saveCarouselPost, updateCarouselPost, contentIdeasAction, autoGenerateAction, generateWeekAction, recreateViralAction, generateSlideAiImage } from "@/app/projects/[id]/generate/actions";
import type { GenerateCarouselResult } from "@/app/projects/[id]/generate/actions";
import { Sparkles, Save, Loader2, RefreshCw, ImagePlus, ChevronLeft, ChevronRight, Lightbulb, Wand2, CalendarDays, ChevronDown, ChevronUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { LayoutStyle } from "@/components/templates/AdTemplateTakumi";
import type { CarouselSlide, TargetingContext, FunnelStage, BuyerJourney, ToneId, ContentIdea } from "@/lib/anthropic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CAROUSEL_FRAMEWORKS, DEFAULT_FRAMEWORK_ID } from "@/lib/carousel-frameworks";
import { ScreenshotStrip } from "./ScreenshotStrip";
import { PALETTES, DEFAULT_PALETTE_ID, legacyPresetToPalette } from "@/lib/design-palettes";

const TONE_OPTIONS: { id: ToneId; label: string }[] = [
  { id: "bold-direct", label: "Bold & Direct" },
  { id: "mentor-teacher", label: "Mentor / Teacher" },
  { id: "witty-sassy", label: "Witty / Sassy" },
  { id: "luxury-premium", label: "Luxury / Premium" },
  { id: "casual-friendly", label: "Casual / Friendly" },
  { id: "inspirational", label: "Inspirational" },
];

type EditPost = {
  id: string;
  templateType: string | null;
  layoutStyle: string | null;
  headline: string | null;
  headlineHighlight: string | null;
  subtext: string | null;
  boldPhrases: string | null;
  caption: string | null;
  hashtags: string | null;
  backgroundPreset: string | null;
  backgroundImageUrl: string | null;
  imageMode: string | null;
  metadata: string | null;
  projectId: string | null;
  targetingContext: string | null;
  palette: string | null;
  imagePath: string | null;
  carouselSlides: string | null;
} | null;

function parseEditPost(editPost: EditPost) {
  if (!editPost) return null;
  let metadata: { stats?: { label: string; value: string; change?: string }[]; socialProof?: string; ctaText?: string; topic?: string; caption?: string } = {};
  try { metadata = JSON.parse(editPost.metadata || "{}"); } catch {}
  let boldPhrases: string[] = [];
  try { boldPhrases = JSON.parse(editPost.boldPhrases || "[]"); } catch {}
  let targetingCtx: TargetingContext | null = null;
  try { targetingCtx = editPost.targetingContext ? JSON.parse(editPost.targetingContext) : null; } catch {}
  let carouselSlides: CarouselSlide[] = [];
  try { carouselSlides = editPost.carouselSlides ? JSON.parse(editPost.carouselSlides) : []; } catch {}
  return {
    templateType: (editPost.templateType === "reel" ? "reel" : editPost.templateType === "carousel" ? "carousel" : "ad") as "ad" | "reel" | "carousel",
    carouselSlides,
    imagePath: editPost.imagePath,
    backgroundImageUrl: editPost.backgroundImageUrl,
    imageMode: editPost.imageMode,
    layoutStyle: (editPost.layoutStyle || "bold-statement") as LayoutStyle,
    headlineStart: editPost.headline || "",
    headlineHighlight: editPost.headlineHighlight || "",
    subtext: editPost.subtext || "",
    boldPhrases: boldPhrases.join(", "),
    caption: editPost.caption || "",
    hashtags: editPost.hashtags || "",
    backgroundPreset: editPost.backgroundPreset || "dark-gradient",
    paletteId: editPost.palette
      ? editPost.palette
      : legacyPresetToPalette(editPost.backgroundPreset || "dark-gradient"),
    socialProof: metadata.socialProof || "",
    ctaText: metadata.ctaText || "",
    stats: metadata.stats || [],
    targetingCtx,
  };
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { base64: btoa(binary), mimeType: file.type };
}

export function GeneratorForm({
  projectId,
  brandColor,
  editPost = null,
  topicChips = [],
  allowedPaletteIds = [],
}: {
  projectId: string;
  brandColor: string;
  editPost?: EditPost;
  /** Brand Kit content pillars — one-click topic starters */
  topicChips?: { label: string; value: string }[];
  /** Brand Kit palette restriction — empty = all palettes */
  allowedPaletteIds?: string[];
}) {
  const parsed = parseEditPost(editPost);
  const isEditing = !!editPost;
  const palettes = allowedPaletteIds.length
    ? PALETTES.filter((p) => allowedPaletteIds.includes(p.id))
    : PALETTES;

  const [isPending, startTransition] = useTransition();
  const [templateType, setTemplateType] = useState<"ad" | "reel" | "carousel">(parsed?.templateType ?? "ad");
  const isEditingCarousel = isEditing && parsed?.templateType === "carousel";
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>(parsed?.layoutStyle ?? 'bold-statement');
  const [prompt, setPrompt] = useState("");

  // Viral mode state
  const [viralMode, setViralMode] = useState(false);
  const [viralText, setViralText] = useState("");
  const [viralImageBase64, setViralImageBase64] = useState<string | null>(null);
  const [viralImageMimeType, setViralImageMimeType] = useState<string | null>(null);
  const [viralImageName, setViralImageName] = useState<string | null>(null);
  const [isGeneratingViral, setIsGeneratingViral] = useState(false);

  // Template fields — pre-filled from editPost if present
  const [headlineStart, setHeadlineStart] = useState(parsed?.headlineStart ?? "Turn your data into");
  const [headlineHighlight, setHeadlineHighlight] = useState(parsed?.headlineHighlight ?? "revenue insights");
  const [subtext, setSubtext] = useState(parsed?.subtext ?? "Stop wasting hours on complex SQL queries. Get instant answers in plain English.");
  const [boldPhrases, setBoldPhrases] = useState(parsed?.boldPhrases ?? "complex SQL queries, instant answers");
  const [socialProof, setSocialProof] = useState(parsed?.socialProof ?? "Join 500+ GTM teams");
  const [ctaText, setCtaText] = useState(parsed?.ctaText ?? "Get Started Free");
  const [caption, setCaption] = useState(parsed?.caption ?? "");
  const [hashtags, setHashtags] = useState(parsed?.hashtags ?? "");
  // Brand Kit palette lock: default to the first allowed palette so brand-locked
  // projects never start on an off-brand color scheme.
  const [paletteId, setPaletteId] = useState<string>(
    parsed?.paletteId ?? allowedPaletteIds[0] ?? DEFAULT_PALETTE_ID
  );
  const [imageMode, setImageMode] = useState<string | null>(parsed?.imageMode ?? null);
  const [stats, setStats] = useState<{ label: string; value: string; change?: string }[]>(
    parsed?.stats?.length ? parsed.stats : [
      { label: "Revenue", value: "$47.2K", change: "+12.5%" },
      { label: "Users", value: "1,247", change: "+8.3%" },
      { label: "Conv. Rate", value: "2.1%", change: "+0.4%" },
    ]
  );

  // Background image — user upload or AI-generated (FAL) plate
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(parsed?.backgroundImageUrl ?? null);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Bumped after every upload so the reusable screenshot strip re-fetches
  const [uploadsKey, setUploadsKey] = useState(0);

  // Per-slide reference upload + manual AI redesign (opt-in, not a global default)
  const [uploadingSlideImg, setUploadingSlideImg] = useState(false);
  const [slideAiPrompt, setSlideAiPrompt] = useState("");
  const [generatingSlideAi, setGeneratingSlideAi] = useState(false);
  // AI redesign overwrites the slide image in place — keep the previous one so a
  // bad generation is one click away from being undone. Keyed by slide index.
  const [slideImageUndo, setSlideImageUndo] = useState<Record<number, { url?: string; mode?: string }>>({});

  // Carousel state
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>(parsed?.carouselSlides ?? []);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [carouselCaption, setCarouselCaption] = useState(isEditingCarousel ? parsed?.caption ?? "" : "");
  const [carouselHashtags, setCarouselHashtags] = useState(isEditingCarousel ? parsed?.hashtags ?? "" : "");

  // Carousel framework state
  const [frameworkId, setFrameworkId] = useState(DEFAULT_FRAMEWORK_ID);
  const [slideCount, setSlideCount] = useState(
    CAROUSEL_FRAMEWORKS.find((f) => f.id === DEFAULT_FRAMEWORK_ID)?.defaultSlideCount ?? 5
  );

  // Targeting & Tone state (shared across all tabs)
  const [targetAudience, setTargetAudience] = useState(parsed?.targetingCtx?.targetAudience ?? "");
  const [painPoint, setPainPoint] = useState(parsed?.targetingCtx?.painPoint ?? "");
  const [funnelStage, setFunnelStage] = useState<FunnelStage | "">(parsed?.targetingCtx?.funnelStage ?? "");
  const [buyerJourney, setBuyerJourney] = useState<BuyerJourney | "">(parsed?.targetingCtx?.buyerJourney ?? "");
  const [selectedTone, setSelectedTone] = useState<ToneId | "">(parsed?.targetingCtx?.tone ?? "");
  const [conversionBoost, setConversionBoost] = useState(parsed?.targetingCtx?.conversionBoost ?? false);

  // Content Ideas — persisted per project so they survive reloads
  const ideasStorageKey = `adforge-ideas-${projectId}`;
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideasLoading, setIdeasLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ideasStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ContentIdea[];
        if (parsed.length) { setIdeas(parsed); setIdeasOpen(true); }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistIdeas = (next: ContentIdea[]) => {
    setIdeas(next);
    try { localStorage.setItem(ideasStorageKey, JSON.stringify(next)); } catch {}
  };

  // Generate Week state
  const [weekLoading, setWeekLoading] = useState(false);

  // Derived — undefined (not {}) when all fields empty, so no empty block is sent to prompts
  const targetingContext = useMemo((): TargetingContext | undefined => {
    const ctx: TargetingContext = {};
    if (targetAudience.trim()) ctx.targetAudience = targetAudience.trim();
    if (painPoint.trim()) ctx.painPoint = painPoint.trim();
    if (funnelStage) ctx.funnelStage = funnelStage;
    if (buyerJourney) ctx.buyerJourney = buyerJourney;
    if (selectedTone) ctx.tone = selectedTone;
    if (conversionBoost) ctx.conversionBoost = true;
    return Object.keys(ctx).length > 0 ? ctx : undefined;
  }, [targetAudience, painPoint, funnelStage, buyerJourney, selectedTone, conversionBoost]);

  // Preview state — when editing, start with the already-rendered image
  const [previewUrl, setPreviewUrl] = useState<string | null>(parsed?.imagePath ?? null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const prevPreviewUrlRef = useRef<string | null>(null);

  const handleFrameworkChange = (id: string | null) => {
    if (!id) return;
    const fw = CAROUSEL_FRAMEWORKS.find((f) => f.id === id);
    setFrameworkId(id);
    if (fw) setSlideCount(fw.defaultSlideCount);
  };

  const handleFetchIdeas = async () => {
    setIdeasLoading(true);
    try {
      const result = await contentIdeasAction(projectId, targetingContext);
      if (result.success && result.ideas) {
        persistIdeas(result.ideas);
        setIdeasOpen(true);
      } else {
        toast.error(result.error || "Failed to fetch ideas");
      }
    } catch {
      toast.error("Failed to fetch ideas");
    } finally {
      setIdeasLoading(false);
    }
  };

  const handleSelectIdea = (idea: ContentIdea) => {
    setPrompt(idea.title);
    if (idea.postType === "carousel") {
      setTemplateType("carousel");
      if (idea.framework) {
        const fw = CAROUSEL_FRAMEWORKS.find((f) => f.id === idea.framework);
        setFrameworkId(idea.framework);
        if (fw) setSlideCount(fw.defaultSlideCount);
      }
    } else {
      setTemplateType(idea.postType as "ad" | "reel");
    }
    toast.success("Idea loaded into the prompt, edit it there and hit Generate");
  };

  const handleRemoveIdea = (idx: number) => {
    persistIdeas(ideas.filter((_, i) => i !== idx));
  };

  const handleAutoGenerate = () => {
    startTransition(async () => {
      const tt = templateType === "carousel" ? "ad" : (templateType as "ad" | "reel");
      const result = await autoGenerateAction(projectId, tt, layoutStyle, targetingContext, paletteId);
      if (result.success && result.data) {
        const d = result.data;
        setHeadlineStart(d.headlineStart);
        setHeadlineHighlight(d.headlineHighlight);
        setSubtext(d.subtext);
        setBoldPhrases(d.boldPhrases.join(", "));
        setSocialProof(d.socialProof);
        setCtaText(d.ctaText);
        setCaption(d.caption);
        setHashtags(d.hashtags);
        if (d.stats) setStats(d.stats);
        if (d.layoutStyle) setLayoutStyle(d.layoutStyle as LayoutStyle);
        if (d.paletteId) setPaletteId(d.paletteId);
        setImageMode(d.imageMode ?? null);
        setBackgroundImageUrl(d.backgroundImageUrl ?? null);
        toast.success("Auto-generated from Knowledge Base!");
      } else {
        toast.error(result.error || "Auto-generation failed");
      }
    });
  };

  const handleGenerateWeek = async () => {
    setWeekLoading(true);
    try {
      const result = await generateWeekAction(projectId, targetingContext, paletteId);
      if (result.success) {
        toast.success(`Generated ${result.postCount} posts — check the queue!`);
      } else {
        toast.error(result.error || "Generate Week failed");
      }
    } catch {
      toast.error("Generate Week failed");
    } finally {
      setWeekLoading(false);
    }
  };

  const refreshPreview = useCallback(async () => {
    // For carousel, only render if we have slides
    if (templateType === "carousel" && !carouselSlides[activeSlideIdx]) return;

    setPreviewLoading(true);
    setPreviewError(false);
    try {
      // fal_full: the AI image IS the post — show it directly
      if (templateType !== "carousel" && imageMode === "fal_full" && backgroundImageUrl) {
        setPreviewUrl(backgroundImageUrl);
        return;
      }
      const slide = templateType === "carousel" ? carouselSlides[activeSlideIdx] : null;
      if (slide?.imageMode === "fal_full" && slide.backgroundImageUrl) {
        setPreviewUrl(slide.backgroundImageUrl);
        return;
      }
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: true,
          // Carousel slides render at the feed 4:5 canvas (ad dimensions)
          templateType: templateType === "carousel" ? "ad" : templateType,
          layoutStyle,
          palette: slide ? (slide.paletteId ?? paletteId ?? legacyPresetToPalette(slide.backgroundPreset || "dark-gradient")) : paletteId,
          backgroundImageUrl: (slide ? slide.backgroundImageUrl : backgroundImageUrl) ?? undefined,
          brandColor,
          headlineStart: slide ? slide.headlineStart : headlineStart,
          headlineHighlight: slide ? slide.headlineHighlight : headlineHighlight,
          subtext: slide ? slide.subtext : subtext,
          boldPhrases: slide ? [] : boldPhrases.split(',').map((s: string) => s.trim()).filter(Boolean),
          socialProof: slide ? "" : socialProof,
          ctaText: slide ? (slide.ctaText || "") : ctaText,
          stats: slide ? [] : stats,
        }),
      });
      if (!res.ok) throw new Error('Render failed');
      const blob = await res.blob();
      if (prevPreviewUrlRef.current) URL.revokeObjectURL(prevPreviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevPreviewUrlRef.current = url;
      setPreviewUrl(url);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [templateType, imageMode, layoutStyle, paletteId, backgroundImageUrl, brandColor, headlineStart, headlineHighlight, subtext, boldPhrases, socialProof, ctaText, stats, carouselSlides, activeSlideIdx]);

  // Keep a ref to the latest refreshPreview so debounced callbacks never use stale closures
  const latestRefreshPreview = useRef(refreshPreview);
  useEffect(() => { latestRefreshPreview.current = refreshPreview; });

  // Immediate refresh when template/background controls change (discrete clicks)
  useEffect(() => {
    latestRefreshPreview.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutStyle, paletteId, backgroundImageUrl, templateType, activeSlideIdx, carouselSlides]);

  // Debounced refresh when content text changes — fires AFTER React commits new state
  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
    contentDebounceRef.current = setTimeout(() => {
      latestRefreshPreview.current();
    }, 600);
    return () => {
      if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlineStart, headlineHighlight, subtext, boldPhrases, socialProof, ctaText, stats]);

  const handleUploadBackground = async (file: File) => {
    setUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { path } = await res.json();
      setBackgroundImageUrl(path);
      setUploadsKey((k) => k + 1);
      toast.success("Background uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingBg(false);
    }
  };

  // Accepts several files at once so a whole screenshot set lands in the library
  // in one go; the first one is applied to the active slide.
  const handleUploadSlideImage = async (files: File[]) => {
    setUploadingSlideImg(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        paths.push((await res.json()).path);
      }
      const [first] = paths;
      if (first) setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, backgroundImageUrl: first, imageMode: undefined } : s));
      setUploadsKey((k) => k + 1);
      toast.success(paths.length > 1 ? `${paths.length} images uploaded, pick one per slide below` : "Slide image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingSlideImg(false);
    }
  };

  const handleGenerateSlideAi = async () => {
    if (!slideAiPrompt.trim()) {
      toast.error("Describe what the AI should design for this slide");
      return;
    }
    setGeneratingSlideAi(true);
    try {
      const slide = carouselSlides[activeSlideIdx];
      const result = await generateSlideAiImage(projectId, slideAiPrompt.trim(), slide?.backgroundImageUrl || undefined);
      if ("error" in result) throw new Error(result.error);
      const idx = activeSlideIdx;
      setSlideImageUndo(u => ({ ...u, [idx]: { url: slide?.backgroundImageUrl, mode: slide?.imageMode } }));
      setCarouselSlides(slides => slides.map((s, i) => i === idx ? { ...s, backgroundImageUrl: result.url, imageMode: "fal_full" } : s));
      toast.success("AI slide generated, check the preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGeneratingSlideAi(false);
    }
  };

  const handleRecreateViral = async () => {
    if (!viralText.trim() && !viralImageBase64) {
      toast.error("Paste viral post text or upload a screenshot");
      return;
    }
    setIsGeneratingViral(true);
    try {
      const viralInput = {
        text: viralText.trim() || undefined,
        imageBase64: viralImageBase64 || undefined,
        imageMimeType: viralImageMimeType || undefined,
      };

      const result = await recreateViralAction(
        projectId,
        viralInput,
        templateType === "carousel" ? "carousel" : templateType === "reel" ? "reel" : "ad",
        templateType === "carousel" ? frameworkId : undefined,
        templateType === "carousel" ? slideCount : undefined,
        layoutStyle,
        targetingContext,
        paletteId
      );

      if (!result.success) {
        toast.error(result.error || "Recreate failed");
        return;
      }

      if (templateType === "carousel" && "slides" in result && result.slides) {
        // Carousel path
        setCarouselSlides(result.slides);
        if (result.caption) setCarouselCaption(result.caption);
        if (result.hashtags) setCarouselHashtags(result.hashtags);
        setActiveSlideIdx(0);
        // Auto-select detected framework per D-07
        const carouselResult = result as GenerateCarouselResult;
        if (carouselResult.detectedFramework) {
          setFrameworkId(carouselResult.detectedFramework);
        }
        // Update AI-selected layout/palette per D-19, D-20
        if (carouselResult.layoutStyle) setLayoutStyle(carouselResult.layoutStyle as LayoutStyle);
        if (carouselResult.paletteId) setPaletteId(carouselResult.paletteId);
        if (carouselResult.imageMode) setImageMode(carouselResult.imageMode);
        toast.success("Carousel recreated from viral content!");
      } else if ("data" in result && result.data) {
        // Feed/reel path
        const data = result.data;
        setHeadlineStart(data.headlineStart);
        setHeadlineHighlight(data.headlineHighlight);
        setSubtext(data.subtext);
        setBoldPhrases(data.boldPhrases.join(", "));
        if (data.socialProof) setSocialProof(data.socialProof);
        if (data.ctaText) setCtaText(data.ctaText);
        setCaption(data.caption);
        setHashtags(data.hashtags);
        if (data.stats) setStats(data.stats);
        // Update AI-selected layout/palette per D-19, D-20
        if (data.layoutStyle) setLayoutStyle(data.layoutStyle as LayoutStyle);
        if (data.paletteId) setPaletteId(data.paletteId);
        toast.success("Content recreated from viral post!");
      }
    } catch {
      toast.error("Recreate failed — check console");
    } finally {
      setIsGeneratingViral(false);
    }
  };

  const handleGenerateCarousel = () => {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    startTransition(async () => {
      const result = await generateCarouselAction(projectId, prompt, frameworkId, slideCount, targetingContext);
      if (result.success && result.slides) {
        setCarouselSlides(result.slides);
        setCarouselCaption(result.caption ?? "");
        setCarouselHashtags(result.hashtags ?? "");
        setActiveSlideIdx(0);
        // Update AI-selected layout/palette per D-19, D-20
        if (result.layoutStyle) setLayoutStyle(result.layoutStyle as LayoutStyle);
        if (result.paletteId) setPaletteId(result.paletteId);
        if (result.imageMode) setImageMode(result.imageMode);
        toast.success("Carousel generated!");
      } else {
        toast.error(result.error || "Generation failed");
      }
    });
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    startTransition(async () => {
      const result = await generateAction(projectId, prompt, templateType as "ad" | "reel", layoutStyle, targetingContext);
      if (result.success && result.data) {
        const d = result.data;
        setHeadlineStart(d.headlineStart);
        setHeadlineHighlight(d.headlineHighlight);
        setSubtext(d.subtext);
        setBoldPhrases(d.boldPhrases.join(", "));
        setSocialProof(d.socialProof);
        setCtaText(d.ctaText);
        setCaption(d.caption);
        setHashtags(d.hashtags);
        if (d.stats) setStats(d.stats);
        // Update AI-selected layout/palette per D-19, D-20
        if (d.layoutStyle) setLayoutStyle(d.layoutStyle as LayoutStyle);
        if (d.paletteId) setPaletteId(d.paletteId);
        // Brand-kit FAL background (or full image) generated server-side
        setImageMode(d.imageMode ?? null);
        setBackgroundImageUrl(d.backgroundImageUrl ?? null);
        toast.success("Content generated!");
      } else {
        toast.error(result.error || "Generation failed — check your prompt and try again");
      }
    });
  };

  const postData = {
    headlineStart,
    headlineHighlight,
    subtext,
    boldPhrases: boldPhrases.split(",").map((s) => s.trim()).filter(Boolean),
    caption,
    hashtags,
    backgroundPreset: "dark-gradient", // legacy field — kept for DB schema compat; palette column takes precedence
    backgroundImageUrl: backgroundImageUrl ?? undefined,
    stats,
    socialProof,
    ctaText,
    layoutStyle,
    targetingContext,
    paletteId,            // NEW — passed to all server actions
    imageMode: imageMode ?? undefined,
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        if (templateType === "carousel") {
          if (!carouselSlides.length) { toast.error("Generate carousel slides first"); return; }
          if (isEditingCarousel && editPost) {
            await updateCarouselPost(editPost.id, projectId, carouselSlides, carouselCaption, carouselHashtags, targetingContext, paletteId, imageMode ?? undefined, layoutStyle);
            toast.success("Carousel updated!");
          } else {
            await saveCarouselPost(projectId, carouselSlides, carouselCaption, carouselHashtags, targetingContext, paletteId, imageMode ?? undefined, layoutStyle);
            toast.success("Carousel saved to queue!");
          }
        } else if (isEditing && editPost) {
          await updatePost(editPost.id, projectId, templateType as "ad" | "reel", postData);
          toast.success("Post updated!");
        } else {
          await savePost(projectId, templateType as "ad" | "reel", postData);
          toast.success("Post saved to queue!");
        }
      } catch {
        toast.error("Failed to save — try again");
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top section: Template picker + Post type tabs */}
      <TemplatePicker
        selected={layoutStyle}
        onChange={setLayoutStyle}
        templateType={templateType === "carousel" ? "ad" : templateType}
        brandColor={brandColor}
      />

      <div>
        <Tabs value={templateType} onValueChange={(v) => setTemplateType(v as "ad" | "reel" | "carousel")}>
          <TabsList className="w-full">
            <TabsTrigger value="ad" className="flex-1">Feed Post</TabsTrigger>
            <TabsTrigger value="reel" className="flex-1">Reel</TabsTrigger>
            <TabsTrigger value="carousel" className="flex-1">Carousel</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: content fields */}
        <div className="space-y-6">
          {/* Content Ideas Panel */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Content Ideas
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchIdeas}
                    disabled={ideasLoading}
                  >
                    {ideasLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Get Ideas"
                    )}
                  </Button>
                  {ideas.length > 0 && (
                    <button
                      onClick={() => setIdeasOpen(!ideasOpen)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {ideasOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            {ideasOpen && ideas.length > 0 && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-2">
                  {ideas.map((idea, i) => (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectIdea(idea)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{idea.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{idea.reasoning}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {idea.postType}
                          </span>
                          {idea.framework && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {CAROUSEL_FRAMEWORKS.find((f) => f.id === idea.framework)?.name ?? idea.framework}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveIdea(i); }}
                            className="p-0.5 text-muted-foreground hover:text-destructive"
                            title="Discard idea"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* AI Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Recreate Viral Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={viralMode}
                  onCheckedChange={setViralMode}
                  size="sm"
                />
                <label className="text-sm font-medium cursor-pointer" onClick={() => setViralMode(v => !v)}>
                  Recreate Viral
                </label>
              </div>

              {viralMode ? (
                <div className="space-y-3">
                  <textarea
                    value={viralText}
                    onChange={(e) => setViralText(e.target.value)}
                    placeholder="Paste a viral post..."
                    className="w-full min-h-[160px] rounded-lg border border-border bg-background px-4 py-3 text-sm resize-y"
                    rows={8}
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 border border-dashed border-border rounded-lg">
                      <Upload className="w-4 h-4" />
                      {viralImageName ? viralImageName : "Upload screenshot"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { base64, mimeType } = await fileToBase64(file);
                          setViralImageBase64(base64);
                          setViralImageMimeType(mimeType);
                          setViralImageName(file.name);
                        }}
                      />
                    </label>
                    {viralImageName && (
                      <button
                        type="button"
                        onClick={() => { setViralImageBase64(null); setViralImageMimeType(null); setViralImageName(null); }}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder={templateType === "carousel" ? "Describe your carousel story... e.g., 'Hook people on our analytics tool, show the problem, our solution, and drive signups'" : "Describe the topic / angle... e.g., 'Why we bake our sourdough overnight'"}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                  />
                  {topicChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topicChips.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setPrompt(t.value)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${prompt === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {templateType === "carousel" && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Framework</Label>
                    <Select value={frameworkId} onValueChange={handleFrameworkChange}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Choose framework" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAROUSEL_FRAMEWORKS.map((fw) => (
                          <SelectItem key={fw.id} value={fw.id}>
                            {fw.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {CAROUSEL_FRAMEWORKS.find((f) => f.id === frameworkId)?.description ?? ""}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Slides</Label>
                    <Input
                      type="number"
                      min={4}
                      max={10}
                      value={slideCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setSlideCount(Math.min(10, Math.max(4, val)));
                      }}
                      className="w-24 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">4 – 10 slides</p>
                  </div>
                </div>
              )}
              <Button
                onClick={viralMode ? handleRecreateViral : (templateType === "carousel" ? handleGenerateCarousel : handleGenerate)}
                disabled={isPending || isGeneratingViral}
                className="w-full"
              >
                {isPending || isGeneratingViral ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {viralMode ? "Recreating..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {viralMode ? "Recreate" : (templateType === "carousel" ? "Generate Carousel" : "Generate Content")}
                  </>
                )}
              </Button>
              {templateType !== "carousel" && (
                <Button
                  variant="outline"
                  onClick={handleAutoGenerate}
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Auto-Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Auto-Generate from KB
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {templateType !== "carousel" && <Separator />}

          {/* Manual content controls */}
          {templateType !== "carousel" && <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Content</h3>
            <div className="space-y-2">
              <Label className="text-xs">Headline Start</Label>
              <Input value={headlineStart} onChange={(e) => setHeadlineStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Headline Highlight</Label>
              <Input value={headlineHighlight} onChange={(e) => setHeadlineHighlight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subtext</Label>
              <Textarea value={subtext} onChange={(e) => setSubtext(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bold Phrases (comma separated)</Label>
              <Input value={boldPhrases} onChange={(e) => setBoldPhrases(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Social Proof</Label>
              <Input value={socialProof} onChange={(e) => setSocialProof(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">CTA Text</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            </div>
          </div>}

          {templateType !== "carousel" && <Separator />}

          {/* Design palette swatch grid */}
          {templateType !== "carousel" && (
            <div className="space-y-3">
              <Label className="text-xs">Design Palette</Label>
              <div className="grid grid-cols-4 gap-2">
                {palettes.map((palette) => (
                  <button
                    key={palette.id}
                    onClick={() => { setPaletteId(palette.id); setBackgroundImageUrl(null); }}
                    className={`w-12 h-12 rounded-lg border-2 transition-all overflow-hidden flex flex-col justify-end ${
                      paletteId === palette.id && !backgroundImageUrl
                        ? "border-primary scale-105"
                        : "border-border"
                    }`}
                    style={{ background: palette.background }}
                    title={palette.name}
                  >
                    <div style={{ display: "flex", gap: 2, justifyContent: "center", padding: "4px 0", background: "rgba(0,0,0,0.3)" }}>
                      {[palette.highlightColor, palette.ctaBackground, palette.subtextColor].map((c, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {/* Background image upload stays below */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${backgroundImageUrl ? "border-primary scale-105" : "border-border"} hover:border-primary`}>
                  {uploadingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBackground(f); }}
                  />
                </label>
                {backgroundImageUrl && (
                  <button onClick={() => setBackgroundImageUrl(null)} className="text-xs text-muted-foreground underline">
                    Remove image
                  </button>
                )}
              </div>
              <ScreenshotStrip
                projectId={projectId}
                refreshKey={uploadsKey}
                selected={backgroundImageUrl}
                onPick={setBackgroundImageUrl}
              />
            </div>
          )}

          {templateType === "carousel" ? (
            <>
              {/* Carousel-level design palette picker */}
              <div className="space-y-3">
                <Label className="text-xs">Design Palette</Label>
                <div className="grid grid-cols-4 gap-2">
                  {palettes.map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => {
                        setPaletteId(palette.id);
                        // Per D-13: changing carousel-level palette resets all per-slide overrides
                        setCarouselSlides(slides => slides.map(s => ({ ...s, paletteId: undefined })));
                      }}
                      className={`w-12 h-12 rounded-lg border-2 transition-all overflow-hidden flex flex-col justify-end ${
                        paletteId === palette.id ? "border-primary scale-105" : "border-border"
                      }`}
                      style={{ background: palette.background }}
                      title={palette.name}
                    >
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", padding: "4px 0", background: "rgba(0,0,0,0.3)" }}>
                        {[palette.highlightColor, palette.ctaBackground, palette.subtextColor].map((c, i) => (
                          <div key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Carousel slide strip */}
              {carouselSlides.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Slides</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {carouselSlides.map((slide, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveSlideIdx(i)}
                        className={`flex-none w-16 rounded border-2 p-1 text-center transition-all ${activeSlideIdx === i ? "border-primary" : "border-border"}`}
                      >
                        <span className="text-xs font-medium">{i + 1}</span>
                        <p className="text-xs text-muted-foreground truncate">{slide.headlineStart}</p>
                      </button>
                    ))}
                  </div>
                  {/* Active slide editor */}
                  {carouselSlides[activeSlideIdx] && (
                    <div className="space-y-3 border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium">Slide {activeSlideIdx + 1} of {carouselSlides.length}</h4>
                        <div className="flex gap-1">
                          <button disabled={activeSlideIdx === 0} onClick={() => setActiveSlideIdx(i => i - 1)} className="p-1 disabled:opacity-30">
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button disabled={activeSlideIdx === carouselSlides.length - 1} onClick={() => setActiveSlideIdx(i => i + 1)} className="p-1 disabled:opacity-30">
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Headline Start</Label>
                        <Input
                          value={carouselSlides[activeSlideIdx].headlineStart}
                          onChange={(e) => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, headlineStart: e.target.value } : s))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Headline Highlight</Label>
                        <Input
                          value={carouselSlides[activeSlideIdx].headlineHighlight}
                          onChange={(e) => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, headlineHighlight: e.target.value } : s))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Subtext</Label>
                        <Textarea
                          rows={2}
                          value={carouselSlides[activeSlideIdx].subtext}
                          onChange={(e) => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, subtext: e.target.value } : s))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">CTA Text</Label>
                        <Input
                          value={carouselSlides[activeSlideIdx].ctaText || ""}
                          onChange={(e) => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, ctaText: e.target.value } : s))}
                        />
                      </div>
                      {/* Per-slide image: upload a real photo/screenshot, or let AI design the whole slide */}
                      <div className="pt-3 border-t border-border space-y-2">
                        <Label className="text-xs">Slide Image</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${carouselSlides[activeSlideIdx].backgroundImageUrl ? "border-primary scale-105" : "border-border"} hover:border-primary`}>
                            {uploadingSlideImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              className="hidden"
                              onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) handleUploadSlideImage(f); }}
                            />
                          </label>
                          {carouselSlides[activeSlideIdx].backgroundImageUrl && (
                            <button
                              onClick={() => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, backgroundImageUrl: undefined, imageMode: undefined } : s))}
                              className="text-xs text-muted-foreground underline"
                            >
                              Remove image
                            </button>
                          )}
                          <span className="text-xs text-muted-foreground">Upload your own photo/screenshot to use as this slide&apos;s background</span>
                        </div>
                        <ScreenshotStrip
                          projectId={projectId}
                          refreshKey={uploadsKey}
                          selected={carouselSlides[activeSlideIdx].backgroundImageUrl}
                          onPick={(path) => setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, backgroundImageUrl: path, imageMode: undefined } : s))}
                        />
                        <Textarea
                          rows={2}
                          placeholder="Describe what the AI should design (e.g. 'raw spectrogram on the left, clean app dashboard on the right, labeled Before / After')"
                          value={slideAiPrompt}
                          onChange={(e) => setSlideAiPrompt(e.target.value)}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={generatingSlideAi} onClick={handleGenerateSlideAi}>
                            {generatingSlideAi ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                            {carouselSlides[activeSlideIdx].backgroundImageUrl ? "AI redesign with uploaded image" : "Let AI design this slide"}
                          </Button>
                          {slideImageUndo[activeSlideIdx] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const prev = slideImageUndo[activeSlideIdx];
                                setCarouselSlides(slides => slides.map((s, i) => i === activeSlideIdx ? { ...s, backgroundImageUrl: prev.url, imageMode: prev.mode } : s));
                                setSlideImageUndo(u => { const next = { ...u }; delete next[activeSlideIdx]; return next; });
                                toast.success("Reverted to the previous image");
                              }}
                            >
                              Undo AI redesign
                            </Button>
                          )}
                          {carouselSlides[activeSlideIdx].imageMode === "fal_full" && (
                            <span className="text-xs text-muted-foreground">AI owns this slide&apos;s text, no overlay applied</span>
                          )}
                        </div>
                        <p className="text-xs text-amber-500/80">
                          AI redesign repaints the whole slide. It will invent fake app UI if you feed it a screenshot, so use it for art, not for screens.
                        </p>
                      </div>
                      {/* Per-slide palette — per D-11, D-12 */}
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Slide palette</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {palettes.map((p) => {
                            const isActive = (carouselSlides[activeSlideIdx]?.paletteId ?? paletteId) === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setCarouselSlides(slides =>
                                    slides.map((s, i) =>
                                      i === activeSlideIdx ? { ...s, paletteId: p.id } : s
                                    )
                                  );
                                }}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${
                                  isActive
                                    ? "border-primary scale-125 ring-2 ring-primary/30"
                                    : "border-border hover:scale-110"
                                }`}
                                style={{ background: p.background }}
                                title={p.name}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Instagram Caption</h3>
                <div className="space-y-2">
                  <Label className="text-xs">Caption</Label>
                  <Textarea value={carouselCaption} onChange={(e) => setCarouselCaption(e.target.value)} rows={4} placeholder="Instagram caption..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Hashtags</Label>
                  <Input value={carouselHashtags} onChange={(e) => setCarouselHashtags(e.target.value)} placeholder="#marketing #saas #growth" />
                </div>
              </div>
            </>
          ) : (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Instagram Caption</h3>
                <div className="space-y-2">
                  <Label className="text-xs">Caption</Label>
                  <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} placeholder="Instagram caption..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Hashtags</Label>
                  <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#marketing #saas #growth" />
                </div>
              </div>
            </>
          )}

          {/* ── Targeting & Tone ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Targeting & Tone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audience fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="targetAudience" className="text-xs">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    placeholder="e.g. SaaS founders doing $10K-$100K MRR"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="painPoint" className="text-xs">Pain Point</Label>
                  <Input
                    id="painPoint"
                    placeholder="e.g. Spending too much time on manual reporting"
                    value={painPoint}
                    onChange={(e) => setPainPoint(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Funnel + Buyer Journey */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Funnel Stage</Label>
                  <Select
                    value={funnelStage}
                    onValueChange={(v) => setFunnelStage((v as FunnelStage) ?? "")}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Any stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOF">Top of Funnel</SelectItem>
                      <SelectItem value="MOF">Middle of Funnel</SelectItem>
                      <SelectItem value="BOF">Bottom of Funnel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Buyer Temperature</Label>
                  <Select
                    value={buyerJourney}
                    onValueChange={(v) => setBuyerJourney((v as BuyerJourney) ?? "")}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Any temp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cold">Cold</SelectItem>
                      <SelectItem value="Warm">Warm</SelectItem>
                      <SelectItem value="Hot">Hot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tone picker — button grid, NOT a Select */}
              <div className="space-y-1.5">
                <Label className="text-xs">Voice & Tone</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTone(selectedTone === t.id ? "" : t.id)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        selectedTone === t.id
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversion Boost toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={conversionBoost}
                  onCheckedChange={setConversionBoost}
                  size="sm"
                />
                <Label
                  className="text-xs cursor-pointer"
                  onClick={() => setConversionBoost((v) => !v)}
                >
                  Conversion Boost
                </Label>
                {conversionBoost && (
                  <span className="text-xs text-muted-foreground">Power words + urgency CTAs + FOMO active</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {isEditing && (
            <p className="text-xs text-muted-foreground text-center">
              Editing existing post — save will update and re-render
            </p>
          )}
          <Button onClick={handleSave} disabled={isPending} variant={isEditing ? "default" : "outline"} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {templateType === "carousel" ? (isEditingCarousel ? "Update Carousel" : "Save Carousel to Queue") : isEditing ? "Update Post" : "Save to Queue"}
              </>
            )}
          </Button>

          {!isEditing && (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <Button
                  variant="outline"
                  onClick={handleGenerateWeek}
                  disabled={weekLoading || isPending}
                  className="w-full"
                >
                  {weekLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating week...
                    </>
                  ) : (
                    <>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Generate Week (5-7 posts)
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Creates 5-7 varied posts from your Knowledge Base and saves them as pending drafts
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: preview area */}
        <div className="flex flex-col gap-3">
          {templateType === "carousel" && carouselSlides.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Slide {activeSlideIdx + 1} of {carouselSlides.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={activeSlideIdx === 0} onClick={() => setActiveSlideIdx(i => i - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" disabled={activeSlideIdx === carouselSlides.length - 1} onClick={() => setActiveSlideIdx(i => i + 1)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          <div className="relative" style={{ aspectRatio: templateType === 'reel' ? '9/16' : '4/5' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Post preview"
                className={`w-full h-full object-contain rounded-lg transition-opacity ${previewLoading ? 'opacity-30' : 'opacity-100'}`}
              />
            )}
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {previewError && !previewLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Preview failed — check console</p>
                <Button variant="outline" size="sm" onClick={refreshPreview}>Retry Preview</Button>
              </div>
            )}
            {!previewUrl && !previewLoading && !previewError && (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {templateType === "carousel" ? "Generate a carousel to preview slides" : "Preview will appear here"}
                </p>
              </div>
            )}
          </div>
          {/* Dot indicators for carousel */}
          {templateType === "carousel" && carouselSlides.length > 0 && (
            <div className="flex justify-center gap-1.5">
              {carouselSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlideIdx(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeSlideIdx ? "bg-primary scale-125" : "bg-muted-foreground/40"}`}
                />
              ))}
            </div>
          )}
          <Button variant="outline" onClick={refreshPreview} disabled={previewLoading} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Preview
          </Button>
        </div>
      </div>
    </div>
  );
}
