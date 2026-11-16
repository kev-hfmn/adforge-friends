import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { knowledgeBase, generatedPosts } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getFramework, DEFAULT_FRAMEWORK_ID, SCREENSHOT_FRAMEWORK_IDS } from "./carousel-frameworks";
import { PALETTES } from "./design-palettes";
import { contextFor } from "./kb";

const anthropic = new Anthropic();

export interface CarouselSlide {
  headlineStart: string;
  headlineHighlight: string;
  subtext: string;
  ctaText: string;
  backgroundPreset: string;
  imagePath?: string; // set after render
  paletteId?: string; // per-slide palette override
  backgroundImageUrl?: string; // FAL-generated per-slide background
  imagePrompt?: string;
  imageMode?: string; // "fal_full" = AI image IS the slide, no Takumi text overlay (manual per-slide opt-in)
}

export interface GeneratedAdContent {
  headlineStart: string;
  headlineHighlight: string;
  subtext: string;
  boldPhrases: string[];
  stats: { label: string; value: string; change?: string }[];
  socialProof: string;
  ctaText: string;
  caption: string;
  hashtags: string;
  backgroundPreset: string;
  layoutStyle: string;   // AI-selected: "bold-statement" | "split-panel" | "data-card"
  paletteId: string;     // AI-selected palette ID from PALETTES
}

// ─── Targeting & Tone Types ──────────────────────────────────────────────────

export type FunnelStage = "TOF" | "MOF" | "BOF";
export type BuyerJourney = "Cold" | "Warm" | "Hot";
export type ToneId =
  | "bold-direct"
  | "mentor-teacher"
  | "witty-sassy"
  | "luxury-premium"
  | "casual-friendly"
  | "inspirational";

export interface TargetingContext {
  targetAudience?: string;
  painPoint?: string;
  funnelStage?: FunnelStage;
  buyerJourney?: BuyerJourney;
  tone?: ToneId;
  conversionBoost?: boolean;
}

export interface ContentIdea {
  title: string;
  postType: "ad" | "reel" | "carousel";
  framework?: string; // framework ID from lib/carousel-frameworks.ts, only for carousel
  reasoning: string;
}

// ─── Tone Instruction Blocks (pre-written — not generated at runtime) ─────────

const TONE_INSTRUCTIONS: Record<ToneId, string> = {
  "bold-direct":
    "Write in short, punchy sentences. Lead with the strongest claim first. No hedging, no softeners — state it plainly and move on. Every word either pulls weight or gets cut.",
  "mentor-teacher":
    "Write with warmth and genuine expertise, like someone who wants the reader to win. Teach something real. Let authority come through in what you know and how precisely you say it — not what you claim about yourself.",
  "witty-sassy":
    "Be sharp and memorable. Light irreverence is welcome — subvert the expected angle with a clever twist. Memorable beats safe every time. One well-placed line beats three earnest ones.",
  "luxury-premium":
    "Use elevated diction with unhurried pacing. Convey exclusivity and aspiration — never desperation. Less is more: every word earns its place, every sentence has room to breathe.",
  "casual-friendly":
    "Write conversationally, like a smart friend who happens to know this topic well. Contractions are fine. Be real and approachable — no corporate speak, no hollow enthusiasm.",
  "inspirational":
    "Pull the reader toward what's possible. Use strong, active verbs and concrete imagery. The copy should make the reader feel something — movement, possibility, the cost of staying still.",
};

// ─── Funnel and Buyer Journey Instruction Blocks ─────────────────────────────

const FUNNEL_STAGE_INSTRUCTIONS: Record<FunnelStage, string> = {
  TOF: "FUNNEL STAGE — Top of Funnel (Awareness): Educate and intrigue. No direct product pitch. Hook curiosity, surface a real problem or insight. Write for someone who does not yet know they need the solution — earn their attention before you earn anything else.",
  MOF: "FUNNEL STAGE — Middle of Funnel (Consideration): Position the product as the solution. Build desire. Assume the reader knows the problem exists — now show clearly and specifically why this is the right answer.",
  BOF: "FUNNEL STAGE — Bottom of Funnel (Decision): Close. Direct CTAs, urgency, and proof points. The reader is ready to act — remove friction, address the last objection, make the offer undeniable. No more nurturing; it is time to ask.",
};

const BUYER_JOURNEY_INSTRUCTIONS: Record<BuyerJourney, string> = {
  Cold: "BUYER TEMPERATURE — Cold: This reader has no prior relationship with the brand. Lead with value before any ask. Acknowledge skepticism implicitly by proving worth upfront — trust is earned, not assumed.",
  Warm: "BUYER TEMPERATURE — Warm: This reader is aware of the brand or problem. Be more direct. Lead with the value proposition — they have seen enough to be interested; do not waste their time re-explaining the basics.",
  Hot: "BUYER TEMPERATURE — Hot: This reader has intent. Assume they are ready. Urgency and directness are appropriate and expected. Do not waste words re-explaining what they already know — get to the point and make acting easy.",
};

// ─── Targeting Block Builder ─────────────────────────────────────────────────

export function buildTargetingBlock(ctx: TargetingContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";

  const parts: string[] = ["\n## Targeting & Tone Instructions\n"];

  if (ctx.targetAudience) {
    parts.push(`TARGET AUDIENCE: ${ctx.targetAudience}`);
  }
  if (ctx.painPoint) {
    parts.push(`PAIN POINT TO ADDRESS: ${ctx.painPoint}`);
  }
  if (ctx.funnelStage) {
    parts.push(FUNNEL_STAGE_INSTRUCTIONS[ctx.funnelStage]);
  }
  if (ctx.buyerJourney) {
    parts.push(BUYER_JOURNEY_INSTRUCTIONS[ctx.buyerJourney]);
  }
  if (ctx.tone) {
    parts.push(`VOICE & TONE: ${TONE_INSTRUCTIONS[ctx.tone]}`);
  }
  if (ctx.conversionBoost) {
    parts.push(
      `CONVERSION BOOST (active): Sharpen every hook with a contextually chosen power word (proven, unlock, transform, stop, start). The CTA must include natural time pressure (today, now, limited, this week). Include a FOMO signal — something the reader would miss by not acting. Use active voice throughout; cut every passive construction.`
    );
  }

  parts.push(
    `\nCRITICAL — ANTI-SLOP RULES (non-negotiable):\n` +
    `- Never open with: "Are you tired of...", "In today's world...", "Introducing...", or any variant of these\n` +
    `- Never use filler affirmations: "Absolutely", "Of course", "Great news", "Excited to share"\n` +
    `- Never make vague benefit claims: "improve your workflow", "take your business to the next level", "unlock your potential", "achieve your goals"\n` +
    `- Never abuse em-dashes or pepper copy with exclamation marks\n` +
    `- Write like a skilled human copywriter who gets paid per result. Specific > generic. Concrete numbers and real claims > abstractions. Earned confidence > hype.`
  );

  return parts.join("\n\n");
}

export async function buildKBContext(projectId: string): Promise<string> {
  const { buildBrandKitContext } = await import("./brand-kit");
  const brandKitBlock = await buildBrandKitContext(projectId);

  const sections = await db.query.knowledgeBase.findMany({
    where: eq(knowledgeBase.projectId, projectId),
    orderBy: (kb, { asc }) => [asc(kb.sortOrder)],
  });

  const hub = contextFor(projectId);
  const kb = hub.entryIds.length
    ? hub.text
    : sections.length === 0
      ? "No knowledge base content available."
      : sections.map((s) => `## ${s.title}\n${s.content || "(empty)"}`).join("\n\n");

  const parts: string[] = [];
  if (brandKitBlock) parts.push(brandKitBlock);
  parts.push(`## Knowledge Base\n\n${kb}`);

  return parts.join("\n\n");
}

export async function fetchRecentPostSummaries(
  projectId: string,
  limit: number = 30
): Promise<string[]> {
  const posts = await db.query.generatedPosts.findMany({
    where: eq(generatedPosts.projectId, projectId),
    orderBy: [desc(generatedPosts.createdAt)],
    columns: {
      headline: true,
      headlineHighlight: true,
      subtext: true,
      templateType: true,
    },
    limit,
  });

  return posts.map(
    (p) =>
      `[${p.templateType ?? "ad"}] ${p.headline ?? ""} ${p.headlineHighlight ?? ""} — ${p.subtext ?? ""}`
  );
}

export function buildDedupBlock(recentSummaries: string[]): string {
  if (recentSummaries.length === 0) return "";

  return (
    "\n\n## Deduplication Guard\n\n" +
    "The following topics/angles have been used in recent posts. " +
    "You MUST NOT repeat these hooks, angles, or key phrases. " +
    "Find a fresh angle, different hook, or new topic entirely.\n\n" +
    recentSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    "\n"
  );
}

// Thin wrapper over generateProjectPost — kept for existing callers.
export async function generateAdContent(
  projectId: string,
  userPrompt: string,
  templateType: "ad" | "reel" = "ad",
  targetingContext?: TargetingContext
): Promise<ProjectPostResult> {
  return generateProjectPost(projectId, {
    format: templateType,
    topic: userPrompt,
    targetingContext,
  });
}

// Thin wrapper over generateProjectPost — kept for existing callers.
export async function generateCarouselContent(
  projectId: string,
  userPrompt: string,
  frameworkId: string = DEFAULT_FRAMEWORK_ID,
  slideCount: number = 5,
  targetingContext?: TargetingContext
): Promise<{ slides: CarouselSlide[]; caption: string; hashtags: string; layoutStyle: string; paletteId: string; imageMode: ImageMode }> {
  const result = await generateProjectPost(projectId, {
    format: "carousel",
    topic: userPrompt,
    targetingContext,
    frameworkId,
    slideCount,
  });
  const slides: CarouselSlide[] = (result.slides ?? []).map((s) => ({
    headlineStart: s.headlineStart,
    headlineHighlight: s.headlineHighlight,
    subtext: s.subtext,
    ctaText: s.ctaText ?? "",
    backgroundPreset: "dark-gradient",
    imagePrompt: s.imagePrompt,
  }));
  if (!slides.length) throw new Error("Carousel generation returned no slides");
  return {
    slides,
    caption: result.caption,
    hashtags: result.hashtags,
    layoutStyle: result.layoutStyle,
    paletteId: result.paletteId,
    imageMode: result.imageMode,
  };
}

export async function recreateViralContent(
  projectId: string,
  viralInput: { text?: string; imageBase64?: string; imageMimeType?: string },
  outputType: "ad" | "reel" | "carousel",
  frameworkId?: string,
  slideCount?: number,
  targetingContext?: TargetingContext
): Promise<
  | { type: "carousel"; slides: CarouselSlide[]; caption: string; hashtags: string; detectedFramework: string; layoutStyle: string; paletteId: string }
  | { type: "single"; headlineStart: string; headlineHighlight: string; subtext: string; boldPhrases: string[]; stats: { label: string; value: string; change?: string }[]; socialProof: string; ctaText: string; caption: string; hashtags: string; backgroundPreset: string; layoutStyle: string; paletteId: string }
> {
  const kbContext = await buildKBContext(projectId);
  const targetingBlock = targetingContext ? buildTargetingBlock(targetingContext) : "";
  const recentPosts = await fetchRecentPostSummaries(projectId, 30);
  const dedupBlock = buildDedupBlock(recentPosts);

  const { CAROUSEL_FRAMEWORKS } = await import("./carousel-frameworks");
  const frameworkList = CAROUSEL_FRAMEWORKS.map(f => `- ${f.id}: ${f.name} — ${f.description}`).join("\n");
  const frameworkIds = CAROUSEL_FRAMEWORKS.map(f => f.id);

  // Build multimodal user content
  const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  if (viralInput.imageBase64 && viralInput.imageMimeType) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: viralInput.imageMimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: viralInput.imageBase64,
      },
    });
  }

  const validLayouts = ["bold-statement", "split-panel", "data-card", "device-showcase"];
  const validPaletteIds = PALETTES.map(p => p.id);

  if (outputType === "carousel") {
    const count = Math.min(10, Math.max(4, slideCount ?? 5));
    const frameworkHint = frameworkId ? `Use the "${frameworkId}" framework.` : "Detect the best-matching framework from the list below.";

    const systemPrompt = `You are an expert Instagram carousel creator. You analyze viral posts and recreate them with original content using a brand's voice.

Brand knowledge base:
${kbContext}
${targetingBlock}
${dedupBlock}

Available carousel frameworks:
${frameworkList}

Visual selection:
- layoutStyle options: bold-statement (default, single headline focus), split-panel (hero stat + bullets — best for data-heavy or comparison content), data-card (metric + stats grid — best for analytics or numbers-focused posts)
- paletteId options: midnight, obsidian, cosmic, deep-navy, clean-white, pearl, slate-light, rose-light, electric, crimson, sunset, noir
- Choose layoutStyle based on content structure: data/stats -> data-card, comparison/story -> split-panel, bold claims -> bold-statement
- Choose paletteId based on tone: authority/premium -> dark palettes (midnight, obsidian, noir), educational/friendly -> light (clean-white, pearl, slate-light), urgency/bold -> bold (electric, crimson, sunset)

Instructions:
1. Analyze the viral post's angle, hook, and structure
2. ${frameworkHint}
3. Generate ${count} slides of ORIGINAL content using the brand's knowledge base and voice
4. Do NOT copy the viral post — extract the structural pattern and viral angle, then apply it to the brand's product/service

Rules for great carousels:
- Each slide's headline should be SHORT and punchy (max 6 words total across headlineStart + headlineHighlight)
- headlineHighlight is the emotionally charged word or phrase (1-3 words)
- subtext should be 1-2 tight sentences, no filler
- Final slide ctaText should be action-oriented
- Non-final slides: ctaText should be an empty string ""
- backgroundPreset must be one of: dark-gradient, light-blue, rainbow, purple-dots, white

Respond ONLY with valid JSON:
{
  "detectedFramework": "framework-id",
  "slides": [
    {
      "headlineStart": "plain text part",
      "headlineHighlight": "colored accent part",
      "subtext": "1-2 sentence supporting copy",
      "ctaText": "",
      "backgroundPreset": "dark-gradient"
    }
  ],
  "caption": "Instagram caption",
  "hashtags": "#tag1 #tag2 #tag3",
  "layoutStyle": "bold-statement",
  "paletteId": "midnight"
}`;

    const inputDescription = viralInput.text
      ? `Viral post text:\n${viralInput.text}`
      : "Analyze the viral Instagram post in the attached image.";
    userContent.push({ type: "text", text: `${inputDescription}\n\nRecreate this as a ${count}-slide carousel. Extract the viral angle and generate ORIGINAL content using the brand's voice. Respond ONLY with JSON.` });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(json);

    // Validate backgroundPreset per slide
    const validPresets = ["dark-gradient", "light-blue", "rainbow", "purple-dots", "white"];
    parsed.slides = (parsed.slides as CarouselSlide[]).map((s: CarouselSlide, i: number) => ({
      ...s,
      backgroundPreset: validPresets.includes(s.backgroundPreset)
        ? s.backgroundPreset
        : validPresets[i % validPresets.length],
    }));

    // Validate detectedFramework
    parsed.detectedFramework = frameworkIds.includes(parsed.detectedFramework)
      ? parsed.detectedFramework
      : "pattern-interrupt";

    // Validate visual fields
    parsed.layoutStyle = validLayouts.includes(parsed.layoutStyle) ? parsed.layoutStyle : "bold-statement";
    parsed.paletteId = validPaletteIds.includes(parsed.paletteId) ? parsed.paletteId : "midnight";

    return { type: "carousel", ...parsed };
  } else {
    // Feed or reel (single image)
    const dimensions = outputType === "ad" ? "1080x1080 square" : "1080x1920 vertical reel";

    const systemPrompt = `You are an expert Instagram ad copywriter and creative director. You analyze viral posts and recreate them with original content using a brand's voice.

Brand knowledge base:
${kbContext}
${targetingBlock}
${dedupBlock}

Visual selection:
- layoutStyle options: bold-statement (default, single headline focus), split-panel (hero stat + bullets — best for data-heavy or comparison content), data-card (metric + stats grid — best for analytics or numbers-focused posts)
- paletteId options: midnight, obsidian, cosmic, deep-navy, clean-white, pearl, slate-light, rose-light, electric, crimson, sunset, noir
- Choose layoutStyle based on content structure: data/stats -> data-card, comparison/story -> split-panel, bold claims -> bold-statement
- Choose paletteId based on tone: authority/premium -> dark palettes (midnight, obsidian, noir), educational/friendly -> light (clean-white, pearl, slate-light), urgency/bold -> bold (electric, crimson, sunset)

Instructions:
1. Analyze the viral post's angle, hook, and structure
2. Condense the viral angle into a single ${dimensions} image format
3. Generate ORIGINAL content using the brand's knowledge base and voice
4. Do NOT copy the viral post — extract the structural pattern and viral angle, then apply it to the brand's product/service

Respond ONLY with valid JSON:
{
  "headlineStart": "First part of headline (plain text)",
  "headlineHighlight": "Highlighted/colored part of headline",
  "subtext": "Supporting text below headline",
  "boldPhrases": ["phrase1", "phrase2"],
  "stats": [{"label": "Revenue", "value": "$47.2K", "change": "+12.5%"}],
  "socialProof": "Join 500+ GTM teams",
  "ctaText": "Get Started Free",
  "caption": "Instagram caption text",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3",
  "backgroundPreset": "dark-gradient",
  "layoutStyle": "bold-statement",
  "paletteId": "midnight"
}`;

    const inputDescription = viralInput.text
      ? `Viral post text:\n${viralInput.text}`
      : "Analyze the viral Instagram post in the attached image.";
    userContent.push({ type: "text", text: `${inputDescription}\n\nRecreate this as a ${outputType} post. Extract the viral angle and generate ORIGINAL content using the brand's voice. Respond ONLY with JSON.` });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(json);

    // Validate visual fields
    parsed.layoutStyle = validLayouts.includes(parsed.layoutStyle) ? parsed.layoutStyle : "bold-statement";
    parsed.paletteId = validPaletteIds.includes(parsed.paletteId) ? parsed.paletteId : "midnight";

    return { type: "single", ...parsed };
  }
}

export async function generateContentIdeas(
  projectId: string,
  targetingContext?: TargetingContext
): Promise<ContentIdea[]> {
  const kbContext = await buildKBContext(projectId);
  const targetingBlock = targetingContext
    ? buildTargetingBlock(targetingContext)
    : "";
  const recentPosts = await fetchRecentPostSummaries(projectId, 30);
  const dedupBlock = buildDedupBlock(recentPosts);

  const { CAROUSEL_FRAMEWORKS } = await import("./carousel-frameworks");
  const frameworkList = CAROUSEL_FRAMEWORKS
    .map((f) => `- ${f.id}: ${f.name} (${f.description})`)
    .join("\n");

  const systemPrompt = `You are an expert Instagram content strategist. Given a brand's knowledge base, suggest 6 specific content ideas that would perform well on Instagram.

Brand knowledge base:
${kbContext}
${targetingBlock}
${dedupBlock}

Available carousel frameworks:
${frameworkList}

For each idea, specify:
- title: A concise, specific topic title (not generic — reference real product features, pain points, or angles from the KB)
- postType: "ad" (single feed image), "reel" (vertical video/image), or "carousel" (multi-slide)
- framework: If postType is "carousel", pick the best framework ID from the list above. Omit for ad/reel.
- reasoning: One sentence explaining why this topic and format would work well right now

Mix of post types required: at least 1 ad, 1 reel, and 2 carousels in your 6 suggestions.

Respond ONLY with valid JSON (no markdown):
{ "ideas": [ { "title": "...", "postType": "...", "framework": "...", "reasoning": "..." } ] }`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          "Generate 6 fresh content ideas based on the brand knowledge base. Avoid any topics covered in recent posts.",
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const json = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(json);
  return (parsed.ideas as ContentIdea[]).slice(0, 6).map((i) => ({
    ...i,
    title: stripDashes(i.title),
    reasoning: stripDashes(i.reasoning),
  }));
}

export async function autoGeneratePost(
  projectId: string,
  templateType: "ad" | "reel" = "ad",
  targetingContext?: TargetingContext
): Promise<ProjectPostResult> {
  const kbContext = await buildKBContext(projectId);
  const recentPosts = await fetchRecentPostSummaries(projectId, 20);
  const dedupBlock = buildDedupBlock(recentPosts);

  // AI composes its own prompt from KB context
  const promptMessage = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: `You are an Instagram content strategist. Given a brand's knowledge base and recent post history, write a single specific, actionable prompt that would produce a high-performing Instagram ${templateType === "reel" ? "reel" : "feed post"}.

Brand KB:
${kbContext}
${dedupBlock}

Rules:
- The prompt must reference specific product features, benefits, or customer pain points from the KB
- It must NOT repeat any angle from the recent posts listed above
- Output ONLY the prompt text, nothing else — no quotes, no labels, no explanation`,
    messages: [
      {
        role: "user",
        content: "Write a fresh content prompt for the next Instagram post.",
      },
    ],
  });

  const autoPrompt =
    promptMessage.content[0].type === "text"
      ? promptMessage.content[0].text.trim()
      : "Create an engaging post about the product";

  return generateAdContent(projectId, autoPrompt, templateType, targetingContext);
}

// ─── Unified project-aware generator ─────────────────────────────────────────
// One brain for every format. Brand Kit + KB (via buildKBContext)
// drive copy, layout, palette, and image style — for any project.

export type PostFormat = "ad" | "reel" | "carousel";
export type ImageMode = "template" | "fal_background" | "fal_full";

export interface ProjectPostResult extends GeneratedAdContent {
  imageMode: ImageMode;
  imagePrompt: string;
  // carousel only:
  slides?: Array<{
    headlineStart: string;
    headlineHighlight: string;
    subtext: string;
    ctaText: string;
    imagePrompt: string;
  }>;
}

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  "bold-statement": "heavy centered hook — big claims, use sparingly",
  "split-panel": "hero stat + bullets — data-heavy or comparison content",
  "data-card": "metric + stats grid — analytics/numbers-focused posts",
  "editorial-lower": "type anchored bottom-left over a photo — default over AI/photo backgrounds",
  "centered-minimal": "centered light typography — quotes, facts, flat backgrounds",
  "device-showcase": "real app screenshot in a phone frame beside the text — the ONLY layout that shows a screenshot undimmed and uncropped; use for app tours, feature reveals, anything where the reader must see the actual screen",
};

const ART_DIRECTOR_BLOCK = `## Art direction (imagePrompt)
You are also an art director for an AI image model (Nano Banana / Gemini).
- Scene-led prompts (200-500 chars): subject → composition → lighting → palette → mood → finish. No vague adjectives ("beautiful", "amazing").
- Never include: brand logos, watermarks, phone screens, app UI mockups, dashboards, charts with numbers — image models mangle them and they undermine trust.
- If the Brand Kit defines an image style lock, every scene must fit that look exactly.
- "fal_background" prompts: NEVER text in the image — the template overlays headline/CTA later. Demand a calm, low-detail region in the upper OR lower third (state which) dark enough for white type.
- "fal_full" prompts: MAY include ONE short text overlay (max 6 words) — state placement, weight, and the exact words. The caption carries the story, not the image.`;

const COPY_QUALITY_BLOCK = `## Copy quality bar
- Hook in the first 8 words. Captions 80-220 words.
- If the Brand Kit defines editorial hard rules, they override everything else here.
- Only claim facts present in the Knowledge Base / Brand Kit. Never invent stats, ratings, store availability, or customer counts.
- ABSOLUTELY NO em dashes or en dashes anywhere in headlines, subtext, captions, or CTAs. Use a period or comma instead. This is a hard rule.
- Never open with "Are you tired of...", "In today's world...", "Introducing...". No filler affirmations, no vague benefit claims ("unlock your potential"), no exclamation-mark spam.
- Write like a skilled human copywriter paid per result: specific > generic, earned confidence > hype.`;

// The models keep sneaking em dashes in despite the prompt rule — scrub
// deterministically. Parenthetical dash reads fine as a comma.
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s+([.,!?])/g, "$1");
}

export async function generateProjectPost(
  projectId: string,
  opts: {
    format: PostFormat;
    topic: string;
    targetingContext?: TargetingContext;
    frameworkId?: string;
    slideCount?: number;
  }
): Promise<ProjectPostResult> {
  const { getBrandKitFields, resolvePaletteId } = await import("./brand-kit");
  const kit = await getBrandKitFields(projectId);
  const kbContext = await buildKBContext(projectId);
  const targetingBlock = opts.targetingContext ? buildTargetingBlock(opts.targetingContext) : "";
  const recentPosts = await fetchRecentPostSummaries(projectId, 30);
  const dedupBlock = buildDedupBlock(recentPosts);
  const hasStyleLock = !!kit.imageStyleLock;

  const layouts = Object.keys(LAYOUT_DESCRIPTIONS).filter(
    (l) => !kit.bannedLayoutStyles.includes(l)
  );
  const paletteIds = kit.allowedPaletteIds.length
    ? kit.allowedPaletteIds
    : PALETTES.map((p) => p.id);

  const imageModeBlock = hasStyleLock
    ? `## Image mode
- "fal_background" (default): AI-generated scene behind the text template. Use for educational/promo posts.
- "fal_full": the image IS the post — pure atmospheric/mood visual. Use when the topic asks for mood or atmosphere.
- "template": flat designed background only — use when an AI image adds nothing.`
    : `## Image mode
- Always "template" — this brand has no image style lock configured.`;

  // Screenshot-led carousels never call FAL — the user's own uploads are the art.
  const isScreenshotFramework =
    opts.format === "carousel" && SCREENSHOT_FRAMEWORK_IDS.includes(opts.frameworkId ?? "");

  const carouselBlock = (() => {
    if (opts.format !== "carousel") return "";
    const framework = getFramework(opts.frameworkId ?? DEFAULT_FRAMEWORK_ID);
    const count = Math.min(10, Math.max(3, opts.slideCount ?? 4));
    const slidePurposes = Array.from({ length: count }, (_, i) =>
      `- Slide ${i + 1}: ${framework.slides[i] ?? framework.slides[framework.slides.length - 1]}`
    ).join("\n");
    if (isScreenshotFramework) {
      return `## Carousel structure — ${framework.name} (${framework.description})
Exactly ${count} slides. THE USER SUPPLIES A REAL APP SCREENSHOT FOR EACH SLIDE — you are writing the words that sit beside those screens, not describing images.
- Leave every imagePrompt as an empty string. Do NOT invent scenes; a generated image would misrepresent the product.
- Headlines max 6 words total (start + highlight). Subtext 1-2 short sentences that tell the reader what they are looking at on that screen and why it matters to them.
- Never describe UI you cannot see. Only name screens and values that the Knowledge Base / Brand Kit confirms exist.
- ctaText only on the final slide (empty string on others).
${slidePurposes}`;
    }
    return `## Carousel structure — ${framework.name} (${framework.description})
Exactly ${count} slides. Headlines max 6 words total (start + highlight), subtext 1-2 tight sentences, ctaText only on the final slide (empty string on others). Each slide gets its own imagePrompt (visually related scenes, varied composition).
${slidePurposes}`;
  })();

  const system = `You are a senior Instagram copywriter and creative director. You produce content that obeys the brand's rules exactly.

${kbContext}
${targetingBlock}
${dedupBlock}
${COPY_QUALITY_BLOCK}

${ART_DIRECTOR_BLOCK}

${imageModeBlock}

## Visual selection
- layoutStyle options: ${layouts.map((l) => `${l} (${LAYOUT_DESCRIPTIONS[l]})`).join("; ")}
- paletteId options: ${paletteIds.join(", ")}
${carouselBlock}`;

  const dimensions =
    opts.format === "reel" ? "1080x1920 vertical reel" : "1080x1350 portrait (4:5)";

  const userPrompt = `Generate an Instagram ${opts.format} post (${dimensions}).
Topic / angle: ${opts.topic}

Return ONLY valid JSON:
{
  "headlineStart": string,        // 1-4 words before the highlight
  "headlineHighlight": string,    // 1-3 words rendered in brand color
  "subtext": string,              // 1 line, 8-16 words
  "boldPhrases": string[],        // phrases from subtext to bold (empty array ok)
  "stats": [{"label": string, "value": string, "change": string}],  // only for data-card layout, else []
  "socialProof": string,          // real proof from KB or empty string
  "ctaText": string,              // 2-4 words
  "caption": string,              // 80-220 word IG caption
  "hashtags": string,             // 8-12 space-separated hashtags
  "imageMode": "template" | "fal_background" | "fal_full",
  "imagePrompt": string,          // art-director prompt (200-500 chars); empty string when imageMode=template
  "layoutStyle": string,          // one of the allowed options
  "paletteId": string,            // one of the allowed options
  "slides": ${opts.format === "carousel" ? '[{ "headlineStart": string, "headlineHighlight": string, "subtext": string, "ctaText": string, "imagePrompt": string }]' : "null"}
}

Output JSON only. No commentary.`;

  const message = await anthropic.messages.create({
    // Sonnet, not Haiku: brand editorial hard rules were being violated by
    // Haiku. Generation volume is low — cost is cents.
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("generateProjectPost: no JSON in response");
  let parsed: ProjectPostResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as ProjectPostResult;
  } catch {
    // Model occasionally emits // comments or trailing commas — strip and retry
    const cleaned = jsonMatch[0]
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,\s*([}\]])/g, "$1");
    parsed = JSON.parse(cleaned) as ProjectPostResult;
  }

  // Enforce brand + schema guarantees regardless of what the model returned
  if (!hasStyleLock) parsed.imageMode = "template";
  if (!parsed.imageMode || !["template", "fal_background", "fal_full"].includes(parsed.imageMode)) {
    parsed.imageMode = hasStyleLock ? "fal_background" : "template";
  }
  // Screenshot carousels: the user's uploads are the art. Force the one layout
  // that shows an image uncropped and undimmed, and never spend a FAL call.
  if (isScreenshotFramework) {
    parsed.imageMode = "template";
    parsed.layoutStyle = "device-showcase";
    if (parsed.slides) parsed.slides = parsed.slides.map((s) => ({ ...s, imagePrompt: "" }));
  }
  if (!parsed.layoutStyle || !layouts.includes(parsed.layoutStyle)) {
    parsed.layoutStyle = parsed.imageMode === "fal_background"
      ? (layouts.includes("editorial-lower") ? "editorial-lower" : layouts[0])
      : (layouts.includes("bold-statement") ? "bold-statement" : layouts[0]);
  }
  parsed.paletteId = resolvePaletteId(kit, parsed.paletteId, paletteIds[0]);
  parsed.boldPhrases = Array.isArray(parsed.boldPhrases) ? parsed.boldPhrases : [];
  parsed.stats = Array.isArray(parsed.stats) ? parsed.stats : [];
  parsed.socialProof = parsed.socialProof ?? "";
  parsed.backgroundPreset = "dark-gradient"; // legacy field — palette takes precedence

  // No em dashes in any copy field, ever
  const record = parsed as unknown as Record<string, unknown>;
  for (const key of ["headlineStart", "headlineHighlight", "subtext", "ctaText", "caption", "socialProof"]) {
    if (typeof record[key] === "string") record[key] = stripDashes(record[key] as string);
  }
  parsed.boldPhrases = parsed.boldPhrases.map(stripDashes);
  if (parsed.slides) {
    parsed.slides = parsed.slides.map((s) => ({
      ...s,
      headlineStart: stripDashes(s.headlineStart),
      headlineHighlight: stripDashes(s.headlineHighlight),
      subtext: stripDashes(s.subtext),
      ctaText: stripDashes(s.ctaText ?? ""),
    }));
  }
  return parsed;
}
