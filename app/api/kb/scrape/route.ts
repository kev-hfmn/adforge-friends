import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import FirecrawlApp from "@mendable/firecrawl-js";
import { db } from "@/lib/db";
import { knowledgeBase } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const anthropic = new Anthropic();

// Section slugs that are always seeded on project creation
const CORE_SECTIONS = [
  "product_overview",
  "brand_voice",
  "target_audience",
  "visual_guidelines",
  "ig_hooks",
  "example_captions",
] as const;

const SECTION_META: Record<typeof CORE_SECTIONS[number], string> = {
  product_overview: "Product Overview",
  brand_voice: "Brand Voice",
  target_audience: "Target Audience",
  visual_guidelines: "Visual Guidelines",
  ig_hooks: "IG Hooks",
  example_captions: "Example Captions",
};

async function fetchPageMarkdown(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey) {
    // Use Firecrawl for clean markdown extraction (handles JS-rendered pages)
    const app = new FirecrawlApp({ apiKey });
    const result = await app.scrape(url, { formats: ["markdown"] });
    const md = result.markdown ?? "";
    if (!md) throw new Error("Firecrawl returned no content for this page");
    return md.slice(0, 8000);
  }

  // Fallback: raw fetch + HTML stripping
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AdForge/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text.slice(0, 6000);
}

interface ScrapedKB {
  product_overview: string;
  brand_voice: string;
  target_audience: string;
  visual_guidelines: string;
  ig_hooks: string;
  example_captions: string;
}

async function extractKBFromText(pageText: string, url: string): Promise<ScrapedKB> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a brand strategist. Analyze this website content and extract structured knowledge base data for an Instagram ad creation tool.

Website URL: ${url}
Website content:
${pageText}

Respond ONLY with a JSON object (no markdown) with these exact keys:

{
  "product_overview": "What is this product/service? What does it do, what problem does it solve, what are its key features and benefits? 3-5 sentences.",
  "brand_voice": "Describe the brand's tone, personality, writing style, values. 2-4 sentences.",
  "target_audience": "Who are their ideal customers? Demographics, pain points, goals. 2-4 sentences.",
  "visual_guidelines": "Based on the brand, suggest visual style: colors, aesthetic, mood for Instagram ads. 2-3 sentences.",
  "ig_hooks": "Write 5 powerful Instagram hook phrases for this brand. Each on a new line starting with •",
  "example_captions": "Write 2 example Instagram captions for this brand. Keep them punchy, include a CTA."
}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(json) as ScrapedKB;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, url } = await req.json();
    if (!projectId || !url) {
      return NextResponse.json({ error: "projectId and url required" }, { status: 400 });
    }

    const normalized = url.startsWith("http") ? url : `https://${url}`;
    new URL(normalized); // throws if invalid

    const pageText = await fetchPageMarkdown(normalized);
    const extracted = await extractKBFromText(pageText, normalized);

    const existing = await db.query.knowledgeBase.findMany({
      where: eq(knowledgeBase.projectId, projectId),
    });

    let updated = 0;
    for (const slug of CORE_SECTIONS) {
      const content = extracted[slug];
      if (!content) continue;

      const existingSection = existing.find((s) => s.section === slug);
      if (existingSection) {
        await db
          .update(knowledgeBase)
          .set({ content, title: SECTION_META[slug], updatedAt: Date.now() })
          .where(and(eq(knowledgeBase.id, existingSection.id)));
      } else {
        // Section doesn't exist yet (e.g. product_overview added after project creation)
        const maxOrder = existing.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1);
        await db.insert(knowledgeBase).values({
          id: uuidv4(),
          projectId,
          section: slug,
          title: SECTION_META[slug],
          content,
          sortOrder: maxOrder + 1,
          updatedAt: Date.now(),
        });
      }
      updated++;
    }

    return NextResponse.json({ success: true, sectionsUpdated: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
