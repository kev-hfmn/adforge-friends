export interface DesignPalette {
  id: string;
  name: string;
  category: "dark" | "light" | "bold";
  background: string;       // CSS background value (gradient string or hex)
  headlineColor: string;    // hex — main headline text
  highlightColor: string;   // hex — headlineHighlight span, divider, bullet dots
  headlineWeight?: number;  // default 900; the light palettes below use 200
  ctaVariant?: "whisper";   // uppercase tracked text instead of a button box
  subtextColor: string;     // hex — subtext / muted text
  ctaBackground: string;    // hex — CTA button background
  ctaTextColor: string;     // hex — CTA button text
  badgeBackground: string;  // rgba — social proof badge background
  badgeTextColor: string;   // hex — social proof badge text
}

export const DEFAULT_PALETTE_ID = "midnight";

export const PALETTES: DesignPalette[] = [
  // ── Dark ──────────────────────────────────────────────────────────────────
  {
    id: "midnight",
    name: "Midnight",
    category: "dark",
    background: "linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #0f0f1e 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#7c3aed",
    subtextColor: "#a1a1aa",
    ctaBackground: "#7c3aed",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(124,58,237,0.20)",
    badgeTextColor: "#c4b5fd",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    category: "dark",
    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1510 40%, #0d0d0d 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#d97706",
    subtextColor: "#9ca3af",
    ctaBackground: "#d97706",
    ctaTextColor: "#000000",
    badgeBackground: "rgba(217,119,6,0.15)",
    badgeTextColor: "#fcd34d",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    category: "dark",
    background: "linear-gradient(135deg, #1a0a2e 0%, #2e0a1a 50%, #0a1a2e 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#38bdf8",
    subtextColor: "#a1a1aa",
    ctaBackground: "#38bdf8",
    ctaTextColor: "#0a1a2e",
    badgeBackground: "rgba(56,189,248,0.15)",
    badgeTextColor: "#7dd3fc",
  },
  {
    id: "deep-navy",
    name: "Deep Navy",
    category: "dark",
    background: "linear-gradient(135deg, #0a0a2a 0%, #1a2a4a 50%, #0a1a2a 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#34d399",
    subtextColor: "#94a3b8",
    ctaBackground: "#34d399",
    ctaTextColor: "#0a2a1a",
    badgeBackground: "rgba(52,211,153,0.15)",
    badgeTextColor: "#6ee7b7",
  },
  // ── Light ─────────────────────────────────────────────────────────────────
  {
    id: "clean-white",
    name: "Clean White",
    category: "light",
    background: "#f8f8fc",
    headlineColor: "#111827",
    highlightColor: "#6366f1",
    subtextColor: "#6b7280",
    ctaBackground: "#6366f1",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(99,102,241,0.10)",
    badgeTextColor: "#4f46e5",
  },
  {
    id: "pearl",
    name: "Pearl",
    category: "light",
    background: "linear-gradient(135deg, #fef9f0 0%, #fdf4e3 50%, #fef9f0 100%)",
    headlineColor: "#1c1917",
    highlightColor: "#b45309",
    subtextColor: "#78716c",
    ctaBackground: "#b45309",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(180,83,9,0.10)",
    badgeTextColor: "#92400e",
  },
  {
    id: "slate-light",
    name: "Slate",
    category: "light",
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
    headlineColor: "#0f172a",
    highlightColor: "#3b82f6",
    subtextColor: "#64748b",
    ctaBackground: "#3b82f6",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(59,130,246,0.10)",
    badgeTextColor: "#1d4ed8",
  },
  {
    id: "rose-light",
    name: "Rose",
    category: "light",
    background: "linear-gradient(135deg, #fff1f2 0%, #fecdd3 30%, #fff1f2 100%)",
    headlineColor: "#1c0a0a",
    highlightColor: "#e11d48",
    subtextColor: "#9f1239",
    ctaBackground: "#e11d48",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(225,29,72,0.10)",
    badgeTextColor: "#be123c",
  },
  // ── Bold ──────────────────────────────────────────────────────────────────
  {
    id: "electric",
    name: "Electric",
    category: "bold",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#06b6d4",
    subtextColor: "#94a3b8",
    ctaBackground: "#06b6d4",
    ctaTextColor: "#0f172a",
    badgeBackground: "rgba(6,182,212,0.20)",
    badgeTextColor: "#22d3ee",
  },
  {
    id: "crimson",
    name: "Crimson",
    category: "bold",
    background: "linear-gradient(135deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#ef4444",
    subtextColor: "#fca5a5",
    ctaBackground: "#ef4444",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(239,68,68,0.20)",
    badgeTextColor: "#fca5a5",
  },
  {
    id: "sunset",
    name: "Sunset",
    category: "bold",
    background: "linear-gradient(135deg, #1a0a00 0%, #2d1a00 50%, #1a0500 100%)",
    headlineColor: "#ffffff",
    highlightColor: "#f97316",
    subtextColor: "#fdba74",
    ctaBackground: "#f97316",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(249,115,22,0.20)",
    badgeTextColor: "#fed7aa",
  },
  {
    id: "noir",
    name: "Noir",
    category: "bold",
    background: "#000000",
    headlineColor: "#ffffff",
    highlightColor: "#ffffff",
    subtextColor: "#a1a1aa",
    ctaBackground: "#ffffff",
    ctaTextColor: "#000000",
    badgeBackground: "rgba(255,255,255,0.10)",
    badgeTextColor: "#e5e5e5",
  },
  // ── Quiet set ─────────────────────────────────────────────────────────────
  // Deep navy, blues and teal, weight-200 headlines, whisper labels.
  {
    id: "cosmic-deep",
    name: "Cosmic Deep",
    category: "dark",
    background: "#0a0a12",
    headlineColor: "#f1f5f9",
    highlightColor: "#7cc4ff",
    subtextColor: "#94a3b8",
    ctaBackground: "#7cc4ff",
    ctaTextColor: "#0a0a12",
    badgeBackground: "rgba(59,130,246,0.18)",
    badgeTextColor: "#7cc4ff",
    headlineWeight: 200,
    ctaVariant: "whisper",
  },
  {
    id: "aurora-violet",
    name: "Aurora Teal",
    category: "dark",
    background: "linear-gradient(160deg, #0a0a12 0%, #0d2b28 100%)",
    headlineColor: "#f1f5f9",
    highlightColor: "#14b8a6",
    subtextColor: "#94a3b8",
    ctaBackground: "#14b8a6",
    ctaTextColor: "#0a0a12",
    badgeBackground: "rgba(20,184,166,0.15)",
    badgeTextColor: "#5eead4",
    headlineWeight: 200,
    ctaVariant: "whisper",
  },
  {
    id: "dawn-grounded",
    name: "Dawn Light",
    category: "light",
    background: "linear-gradient(135deg, #eef4ff 0%, #cfe4ff 100%)",
    headlineColor: "#0a0a12",
    highlightColor: "#3b82f6",
    subtextColor: "#47566e",
    ctaBackground: "#2563eb",
    ctaTextColor: "#ffffff",
    badgeBackground: "rgba(59,130,246,0.12)",
    badgeTextColor: "#2563eb",
    headlineWeight: 200,
    ctaVariant: "whisper",
  },
];

/**
 * Look up a palette by ID. Falls back to midnight (DEFAULT_PALETTE_ID) if not found.
 */
export function getPalette(id: string): DesignPalette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID)!;
}

/**
 * Map the old backgroundPreset string values to new palette IDs.
 * Used for backward compatibility with existing posts that have no `palette` column value.
 */
export function legacyPresetToPalette(preset: string): string {
  const MAP: Record<string, string> = {
    "dark-gradient": "midnight",
    "light-blue":    "deep-navy",
    "rainbow":       "cosmic",
    "purple-dots":   "cosmic",
    "white":         "clean-white",
  };
  return MAP[preset] ?? DEFAULT_PALETTE_ID;
}
