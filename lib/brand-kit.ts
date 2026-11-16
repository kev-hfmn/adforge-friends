import { db } from "./db";
import { projectBrandKits } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrandColorTokens {
  primary?: string;
  background?: string;
  accents?: string[];
  notes?: string;
  /** Named tokens e.g. { "signal-elevated": "#3b82f6", "deep-space": "#0a0a12" } */
  tokens?: Record<string, string>;
}

export interface BrandTypography {
  family?: string;
  maxWeight?: number;
  notes?: string;
}

export interface ContentPillar {
  id: string;
  label: string;
  description?: string;
}

export interface ContentFormat {
  id: string;
  ratio?: string;
  notes?: string;
}

export interface BrandKitFields {
  northStar: string;
  oneLiner: string;
  antiReferences: string;
  colors: BrandColorTokens;
  typography: BrandTypography;
  uiNotes: string;
  visualDos: string;
  visualDonts: string;
  rejectGate: string;
  imageStyleLock: string;
  imageStyleLockNoText: string;
  contentPillars: ContentPillar[];
  formats: ContentFormat[];
  editorialRules: string;
  ctaFacts: string;
  allowedPaletteIds: string[];
  bannedLayoutStyles: string[];
  fullMarkdown: string;
}

export type BrandKitRow = typeof projectBrandKits.$inferSelect;

// ─── Defaults ────────────────────────────────────────────────────────────────

export function emptyBrandKitFields(): BrandKitFields {
  return {
    northStar: "",
    oneLiner: "",
    antiReferences: "",
    colors: { primary: "#6366f1", background: "#0a0a12", accents: [], tokens: {}, notes: "" },
    typography: { family: "Geist, system-ui, sans-serif", maxWeight: 600, notes: "" },
    uiNotes: "",
    visualDos: "",
    visualDonts: "",
    rejectGate: "",
    imageStyleLock: "",
    imageStyleLockNoText: "Absolutely no text, letters, or numbers in the image.",
    contentPillars: [],
    formats: [
      { id: "feed", ratio: "4:5", notes: "Primary feed still" },
      { id: "carousel", ratio: "4:5", notes: "3 to 5 slides" },
      { id: "reel", ratio: "9:16", notes: "8 to 15s" },
    ],
    editorialRules: "",
    ctaFacts: "",
    allowedPaletteIds: [],
    bannedLayoutStyles: [],
    fullMarkdown: "",
  };
}

// ─── Serialization ───────────────────────────────────────────────────────────

export function rowToFields(row: BrandKitRow): BrandKitFields {
  const empty = emptyBrandKitFields();
  return {
    northStar: row.northStar ?? "",
    oneLiner: row.oneLiner ?? "",
    antiReferences: row.antiReferences ?? "",
    colors: safeJson(row.colorsJson, empty.colors),
    typography: safeJson(row.typographyJson, empty.typography),
    uiNotes: row.uiNotes ?? "",
    visualDos: row.visualDos ?? "",
    visualDonts: row.visualDonts ?? "",
    rejectGate: row.rejectGate ?? "",
    imageStyleLock: row.imageStyleLock ?? "",
    imageStyleLockNoText: row.imageStyleLockNoText ?? empty.imageStyleLockNoText,
    contentPillars: safeJson(row.contentPillarsJson, empty.contentPillars),
    formats: safeJson(row.formatsJson, empty.formats),
    editorialRules: row.editorialRules ?? "",
    ctaFacts: row.ctaFacts ?? "",
    allowedPaletteIds: safeJson(row.allowedPaletteIds, empty.allowedPaletteIds),
    bannedLayoutStyles: safeJson(row.bannedLayoutStyles, empty.bannedLayoutStyles),
    fullMarkdown: row.fullMarkdown ?? "",
  };
}

function fieldsToDbValues(fields: BrandKitFields) {
  return {
    northStar: fields.northStar || null,
    oneLiner: fields.oneLiner || null,
    antiReferences: fields.antiReferences || null,
    colorsJson: JSON.stringify(fields.colors ?? {}),
    typographyJson: JSON.stringify(fields.typography ?? {}),
    uiNotes: fields.uiNotes || null,
    visualDos: fields.visualDos || null,
    visualDonts: fields.visualDonts || null,
    rejectGate: fields.rejectGate || null,
    imageStyleLock: fields.imageStyleLock || null,
    imageStyleLockNoText: fields.imageStyleLockNoText || null,
    contentPillarsJson: JSON.stringify(fields.contentPillars ?? []),
    formatsJson: JSON.stringify(fields.formats ?? []),
    editorialRules: fields.editorialRules || null,
    ctaFacts: fields.ctaFacts || null,
    allowedPaletteIds: JSON.stringify(fields.allowedPaletteIds ?? []),
    bannedLayoutStyles: JSON.stringify(fields.bannedLayoutStyles ?? []),
    fullMarkdown: fields.fullMarkdown || null,
    updatedAt: Date.now(),
  };
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getBrandKit(projectId: string): Promise<BrandKitRow | null> {
  const row = await db.query.projectBrandKits.findFirst({
    where: eq(projectBrandKits.projectId, projectId),
  });
  return row ?? null;
}

export async function getBrandKitFields(projectId: string): Promise<BrandKitFields> {
  const row = await getBrandKit(projectId);
  return row ? rowToFields(row) : emptyBrandKitFields();
}

/** Create empty kit if missing. Returns the row. */
export async function ensureBrandKit(
  projectId: string,
  seed?: BrandKitFields
): Promise<BrandKitRow> {
  const existing = await getBrandKit(projectId);
  if (existing) return existing;

  const fields = seed ?? emptyBrandKitFields();
  const id = uuidv4();
  await db.insert(projectBrandKits).values({
    id,
    projectId,
    ...fieldsToDbValues(fields),
    createdAt: Date.now(),
  });
  const created = await getBrandKit(projectId);
  if (!created) throw new Error("Failed to create brand kit");
  return created;
}

export async function saveBrandKit(
  projectId: string,
  fields: BrandKitFields
): Promise<BrandKitRow> {
  const existing = await getBrandKit(projectId);
  const values = fieldsToDbValues(fields);
  if (existing) {
    await db
      .update(projectBrandKits)
      .set(values)
      .where(eq(projectBrandKits.projectId, projectId));
  } else {
    await db.insert(projectBrandKits).values({
      id: uuidv4(),
      projectId,
      ...values,
      createdAt: Date.now(),
    });
  }
  const row = await getBrandKit(projectId);
  if (!row) throw new Error("Failed to save brand kit");
  return row;
}

// ─── Context for generators ──────────────────────────────────────────────────

/** Human-readable block injected into every AI generation prompt. */
export async function buildBrandKitContext(projectId: string): Promise<string> {
  const row = await getBrandKit(projectId);
  if (!row) return "";

  const f = rowToFields(row);
  const hasAny =
    f.northStar ||
    f.oneLiner ||
    f.imageStyleLock ||
    f.editorialRules ||
    f.visualDonts ||
    f.rejectGate ||
    f.ctaFacts;
  if (!hasAny) return "";

  const parts: string[] = ["## Brand Kit (authoritative design + creative rules : obey strictly)"];

  if (f.oneLiner) parts.push(`**Identity:** ${f.oneLiner}`);
  if (f.northStar) parts.push(`**Creative north star:** ${f.northStar}`);
  if (f.antiReferences) parts.push(`**Anti-references (never produce these):**\n${f.antiReferences}`);

  if (f.colors && (f.colors.primary || f.colors.background || f.colors.notes)) {
    parts.push(
      `**Colors:** primary ${f.colors.primary ?? "unspecified"} · background ${f.colors.background ?? "unspecified"}` +
        (f.colors.accents?.length ? ` · accents ${f.colors.accents.join(", ")}` : "") +
        (f.colors.notes ? `\n${f.colors.notes}` : "")
    );
  }
  if (f.typography?.family || f.typography?.notes) {
    parts.push(
      `**Typography:** ${f.typography.family ?? "unspecified"}` +
        (f.typography.maxWeight ? ` · max weight ${f.typography.maxWeight}` : "") +
        (f.typography.notes ? `\n${f.typography.notes}` : "")
    );
  }
  if (f.uiNotes) parts.push(`**UI language:**\n${f.uiNotes}`);
  if (f.visualDos) parts.push(`**Visual DO:**\n${f.visualDos}`);
  if (f.visualDonts) parts.push(`**Visual DON'T:**\n${f.visualDonts}`);
  if (f.rejectGate) parts.push(`**Reject gate:**\n${f.rejectGate}`);
  if (f.editorialRules) parts.push(`**Editorial hard rules:**\n${f.editorialRules}`);
  if (f.ctaFacts) parts.push(`**CTA & product facts (never invent):**\n${f.ctaFacts}`);
  if (f.contentPillars.length) {
    parts.push(
      `**Content pillars:**\n` +
        f.contentPillars.map((p) => `- ${p.label}${p.description ? `: ${p.description}` : ""}`).join("\n")
    );
  }
  if (f.formats.length) {
    parts.push(
      `**Formats:**\n` +
        f.formats.map((x) => `- ${x.id}${x.ratio ? ` (${x.ratio})` : ""}${x.notes ? ` : ${x.notes}` : ""}`).join("\n")
    );
  }
  if (f.bannedLayoutStyles.length) {
    parts.push(`**Banned layout styles for this brand:** ${f.bannedLayoutStyles.join(", ")}`);
  }
  if (f.allowedPaletteIds.length) {
    parts.push(`**Allowed palette IDs only:** ${f.allowedPaletteIds.join(", ")}`);
  }
  if (f.imageStyleLock) {
    parts.push(
      `**Image generation style lock (scene prompts must fit this look):**\n${f.imageStyleLock}`
    );
  }

  return parts.join("\n\n");
}

/**
 * Append project image style lock to a FAL/Higgsfield prompt.
 * For background plates, also append no-text rule.
 */
export async function applyImageStyleLock(
  projectId: string,
  prompt: string,
  imageMode: "fal_background" | "fal_full" | string = "fal_full"
): Promise<string> {
  const f = await getBrandKitFields(projectId);
  if (!f.imageStyleLock) return prompt;
  const noText =
    imageMode === "fal_background" || imageMode === "template"
      ? `\n\n${f.imageStyleLockNoText || "Absolutely no text, letters, or numbers in the image."}`
      : "";
  return `${prompt}\n\n${f.imageStyleLock}${noText}`;
}

export function resolvePaletteId(
  fields: BrandKitFields,
  requested?: string | null,
  fallback = "midnight"
): string {
  const allowed = fields.allowedPaletteIds;
  if (!allowed.length) return requested || fallback;
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? fallback;
}

export function isLayoutBanned(fields: BrandKitFields, layoutStyle?: string | null): boolean {
  if (!layoutStyle || !fields.bannedLayoutStyles.length) return false;
  return fields.bannedLayoutStyles.includes(layoutStyle);
}

// ─── Markdown import (lightweight heuristic) ─────────────────────────────────

/**
 * Parse a brand CLAUDE.md / DESIGN-style markdown into BrandKitFields.
 * Best-effort section extraction; full text stored in fullMarkdown.
 */
export function parseBrandKitMarkdown(md: string, base?: BrandKitFields): BrandKitFields {
  const fields = { ...(base ?? emptyBrandKitFields()), fullMarkdown: md };
  const section = (heading: RegExp) => extractSection(md, heading);

  const north = section(/creative north star|north star/i);
  if (north) fields.northStar = north.slice(0, 2000);

  const identity = section(/one-line identity|identity in one line|^## 1\. brand/i);
  if (identity) {
    const line = identity.split("\n").find((l) => l.trim().startsWith(">") || l.includes("weather"));
    if (line) fields.oneLiner = line.replace(/^>\s*/, "").replace(/\*\*/g, "").trim().slice(0, 500);
  }

  const anti = section(/anti-reference/i);
  if (anti) fields.antiReferences = anti.slice(0, 3000);

  const dos = section(/### do\b|visual do/i);
  if (dos) fields.visualDos = dos.slice(0, 3000);
  const donts = section(/### don't|visual don't|don't:/i);
  if (donts) fields.visualDonts = donts.slice(0, 3000);

  const reject = section(/rejection criteria|reject gate|auto-reject/i);
  if (reject) fields.rejectGate = reject.slice(0, 3000);

  const editorial = section(/hard rules|editorial/i);
  if (editorial) fields.editorialRules = editorial.slice(0, 6000);

  const cta = section(/product facts|cta|google play/i);
  if (cta) fields.ctaFacts = cta.slice(0, 4000);

  const styleLock = section(/higgsfield|image-gen prompt|style lock|prompt color language/i);
  if (styleLock) {
    const fence = styleLock.match(/```[\s\S]*?```/);
    fields.imageStyleLock = (fence ? fence[0].replace(/```\w*\n?|\n?```/g, "") : styleLock)
      .trim()
      .slice(0, 2000);
  }

  // Pull primary hexes if present
  const bg = md.match(/#0a0a12/i);
  const primary = md.match(/#3b82f6/i);
  if (bg) fields.colors.background = "#0a0a12";
  if (primary) fields.colors.primary = "#3b82f6";

  return fields;
}

function extractSection(md: string, heading: RegExp): string {
  const lines = md.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i]) && heading.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return "";
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}
