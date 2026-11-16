// Shared shapes for the knowledge hub. Parsing, sync and the page all use these.

export const KB_TYPES = [
  "fact",
  "voice_rule",
  "banned",
  "story_shape",
  "myth",
  "hook",
  "example",
  "taste",
  "founder_story",
  "audience",
  "pillar",
  "format",
  "faq",
  "cta",
  "note",
] as const;

export type KbType = (typeof KB_TYPES)[number];

export const KB_TYPE_LABELS: Record<KbType, string> = {
  fact: "Facts",
  voice_rule: "Voice",
  banned: "Banned",
  story_shape: "Story shape",
  myth: "Myths",
  hook: "Hooks",
  example: "Examples",
  taste: "Taste",
  founder_story: "Founder stories",
  audience: "Audience",
  pillar: "Pillars",
  format: "Formats",
  faq: "FAQ",
  cta: "Calls to action",
  note: "Notes",
};

export type HubFields = Record<string, string | string[]>;

export type HubEntryDraft = {
  syncKey: string;
  type: KbType;
  title: string;
  body: string;
  fields: HubFields;
  tags: string[];
  pillar: string | null;
};

export type HubWarning = { file: string; message: string };

export function isKbType(value: string): value is KbType {
  return (KB_TYPES as readonly string[]).includes(value);
}

export function slug(value: string): string {
  const text = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (text || "entry").slice(0, 96);
}

export function numbersIn(text: string): string[] {
  return [...new Set(text.match(/\d+(?:\.\d+)?/g) ?? [])];
}

export function clip(value: string, max = 180): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 3).trim()}...`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, stable(record[key])]),
    );
  }
  return value;
}

export function fingerprint(entry: HubEntryDraft): string {
  return JSON.stringify(
    stable({
      type: entry.type,
      title: entry.title,
      body: entry.body,
      fields: entry.fields,
      tags: [...entry.tags].sort(),
      pillar: entry.pillar,
    }),
  );
}
