import React from "react";
import { DesignPalette, getPalette, DEFAULT_PALETTE_ID } from "@/lib/design-palettes";

// Instagram feed / carousel canvas. 4:5 is the tallest ratio IG allows in-feed and
// the one the Brand Kit declares; it claims ~30% more vertical space than square.
export const FEED_W = 1080;
export const FEED_H = 1350;

export type LayoutStyle =
  | "bold-statement"
  | "split-panel"
  | "data-card"
  | "editorial-lower"
  | "centered-minimal"
  | "device-showcase";

export interface AdTemplateProps {
  headlineStart: string;
  headlineHighlight: string;
  subtext: string;
  boldPhrases?: string[];
  backgroundPreset?: "dark-gradient" | "light-blue" | "rainbow" | "purple-dots" | "white";
  stats?: { label: string; value: string; change?: string }[];
  socialProof?: string;
  ctaText?: string;
  brandColor?: string;
  layoutStyle?: LayoutStyle;
  palette?: DesignPalette;
  // Brand assets
  backgroundImageUrl?: string; // absolute URL — renders as full-bleed background with overlay
  logoUrl?: string;            // absolute URL — shown top-left corner
  // SplitPanel
  icon?: string;
  bulletPoints?: string[];
  // DataCard
  metricValue?: string;
  metricUnit?: string;
  metricStatus?: string;
  progressPercent?: number;
}

// ─── Bold Statement Layout ────────────────────────────────────────────────────
// Clean IG feed: hook headline + subtext + CTA, centered, huge readable text

function BoldStatementLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, socialProof, ctaText, palette, brandColor, backgroundImageUrl, logoUrl } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";
  const headlineWeight = palette.headlineWeight ?? 900;
  // Tight negative tracking only works on heavy weights; light weights need air
  const headlineTracking = headlineWeight < 400 ? "0.5px" : "-1.5px";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: FEED_W,
        height: FEED_H,
        padding: "88px 88px",
        position: "relative",
        overflow: "hidden",
        background: palette.background,
      }}
    >
      {/* Background image with dark overlay */}
      {backgroundImageUrl && (
        <>
          <img src={backgroundImageUrl} style={{ position: "absolute", top: 0, left: 0, width: FEED_W, height: FEED_H, objectFit: "cover", display: "flex" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: FEED_W, height: FEED_H, background: "rgba(0,0,0,0.62)", display: "flex" }} />
        </>
      )}


      {/* Brand accent line at top — skipped over photos, it cheapens them */}
      {!backgroundImageUrl && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: brandColor, display: "flex" }} />
      )}

      {/* Logo top-left */}
      {logoUrl && (
        <img src={logoUrl} style={{ position: "absolute", top: 48, left: 88, height: 48, objectFit: "contain", display: "flex" }} />
      )}

      {/* Content stack */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 28,
        }}
      >
        {/* Social proof badge */}
        {socialProof ? (
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 28px",
                borderRadius: 100,
                background: glassBg,
                border: `1px solid ${glassBorder}`,
              }}
            >
              <div style={{ display: "flex", gap: 5 }}>
                {["#4ade80", "#22c55e", "#16a34a"].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: c, display: "flex" }} />
                ))}
              </div>
              <span style={{ fontSize: 30, fontWeight: 500, color: palette.subtextColor }}>{socialProof}</span>
            </div>
          </div>
        ) : null}

        {/* Headline — capped at 4 lines */}
        <div style={{ display: "flex", maxHeight: 340, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: 84,
                fontWeight: headlineWeight,
                lineHeight: 1.08,
                letterSpacing: headlineTracking,
                color: palette.headlineColor,
                fontFamily: "sans-serif",
              }}
            >
              {headlineStart + "\u00A0"}
            </span>
            <span
              style={{
                fontSize: 84,
                fontWeight: headlineWeight,
                lineHeight: 1.08,
                letterSpacing: headlineTracking,
                color: palette.highlightColor,
                fontFamily: "sans-serif",
              }}
            >
              {headlineHighlight}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", width: 64, height: 4, background: palette.highlightColor, borderRadius: 2 }} />

        {/* Subtext — capped at 3 lines */}
        <div style={{ display: "flex", maxHeight: 168, overflow: "hidden", width: "100%" }}>
          <span
            style={{
              fontSize: 42,
              fontWeight: 400,
              lineHeight: 1.4,
              color: palette.subtextColor,
              fontFamily: "sans-serif",
            }}
          >
            {subtext}
          </span>
        </div>

        {/* CTA — whisper variant: tracked uppercase label (DESIGN.md), no button box */}
        {ctaText ? (
          palette.ctaVariant === "whisper" ? (
            <div style={{ display: "flex", marginTop: 16, alignItems: "center", gap: 20 }}>
              <div style={{ display: "flex", width: 56, height: 1, background: `${palette.highlightColor}80` }} />
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  letterSpacing: "10px",
                  color: palette.highlightColor,
                  fontFamily: "sans-serif",
                }}
              >
                {ctaText.toUpperCase()}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", marginTop: 8 }}>
              <div
                style={{
                  display: "flex",
                  padding: "22px 48px",
                  borderRadius: 14,
                  background: palette.ctaBackground,
                }}
              >
                <span style={{ fontSize: 40, fontWeight: 700, color: palette.ctaTextColor }}>{ctaText}</span>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

// ─── Editorial Lower Layout ───────────────────────────────────────────────────
// Photo-first: full-bleed image breathes, gradient scrim only on the lower third,
// light-weight type anchored bottom-left. No boxes, no buttons.

function EditorialLowerLayout(props: AdTemplateProps & { palette: DesignPalette }) {
  const { headlineStart, headlineHighlight, subtext, ctaText, palette, backgroundImageUrl, logoUrl } = props;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: FEED_W,
        height: FEED_H,
        position: "relative",
        overflow: "hidden",
        background: palette.background,
      }}
    >
      {backgroundImageUrl && (
        <img src={backgroundImageUrl} style={{ position: "absolute", top: 0, left: 0, width: FEED_W, height: FEED_H, objectFit: "cover", display: "flex" }} />
      )}
      {/* Scrim only where the type lives — the image stays alive above it */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: FEED_W,
          height: 850, // scrim covers the lower ~63% of the taller 4:5 canvas
          background: "linear-gradient(180deg, rgba(6,8,16,0) 0%, rgba(6,8,16,0.45) 40%, rgba(6,8,16,0.94) 100%)",
          display: "flex",
        }}
      />

      {logoUrl && (
        <img src={logoUrl} style={{ position: "absolute", top: 56, left: 72, height: 44, objectFit: "contain", display: "flex" }} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 26, padding: "0 88px 96px 88px" }}>
        {/* Headline — light weight, airy tracking */}
        <div style={{ display: "flex", maxHeight: 360, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", width: "100%" }}>
            <span style={{ fontSize: 76, fontWeight: 200, lineHeight: 1.12, letterSpacing: "0.5px", color: "#f1f5f9", fontFamily: "sans-serif" }}>
              {headlineStart + "\u00A0"}
            </span>
            <span style={{ fontSize: 76, fontWeight: 200, lineHeight: 1.12, letterSpacing: "0.5px", color: palette.highlightColor, fontFamily: "sans-serif" }}>
              {headlineHighlight}
            </span>
          </div>
        </div>

        {subtext ? (
          <div style={{ display: "flex", maxHeight: 150, overflow: "hidden", width: 820 }}>
            <span style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.45, color: "rgba(203,213,225,0.92)", fontFamily: "sans-serif" }}>
              {subtext}
            </span>
          </div>
        ) : null}

        {ctaText ? (
          <div style={{ display: "flex", marginTop: 10, alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", width: 56, height: 1, background: `${palette.highlightColor}80` }} />
            <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: "10px", color: palette.highlightColor, fontFamily: "sans-serif" }}>
              {ctaText.toUpperCase()}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Centered Minimal Layout ──────────────────────────────────────────────────
// A calm text post: centered light headline,
// whisper kicker + CTA, thin dividers. Works on flat palette or dimmed photo.

function CenteredMinimalLayout(props: AdTemplateProps & { palette: DesignPalette }) {
  const { headlineStart, headlineHighlight, subtext, socialProof, ctaText, palette, backgroundImageUrl, logoUrl } = props;
  const isLight = palette.category === "light";
  const mutedColor = isLight ? "rgba(15,23,42,0.55)" : "rgba(203,213,225,0.65)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: FEED_W,
        height: FEED_H,
        position: "relative",
        overflow: "hidden",
        background: palette.background,
        padding: "96px 100px",
      }}
    >
      {backgroundImageUrl && (
        <>
          <img src={backgroundImageUrl} style={{ position: "absolute", top: 0, left: 0, width: FEED_W, height: FEED_H, objectFit: "cover", display: "flex" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: FEED_W, height: FEED_H, background: "rgba(6,8,16,0.68)", display: "flex" }} />
        </>
      )}

      {logoUrl && (
        <img src={logoUrl} style={{ position: "absolute", top: 64, height: 44, objectFit: "contain", display: "flex" }} />
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: "100%" }}>
        {/* Kicker — whisper label above the headline */}
        {socialProof ? (
          <span style={{ fontSize: 26, fontWeight: 400, letterSpacing: "12px", color: mutedColor, fontFamily: "sans-serif" }}>
            {socialProof.toUpperCase()}
          </span>
        ) : null}

        <div style={{ display: "flex", maxHeight: 380, overflow: "hidden", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
            <span style={{ fontSize: 80, fontWeight: 200, lineHeight: 1.15, letterSpacing: "0.5px", color: backgroundImageUrl ? "#f1f5f9" : palette.headlineColor, fontFamily: "sans-serif", textAlign: "center" }}>
              {headlineStart + "\u00A0"}
            </span>
            <span style={{ fontSize: 80, fontWeight: 200, lineHeight: 1.15, letterSpacing: "0.5px", color: palette.highlightColor, fontFamily: "sans-serif", textAlign: "center" }}>
              {headlineHighlight}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", width: 88, height: 1, background: `${palette.highlightColor}66` }} />

        {subtext ? (
          <div style={{ display: "flex", justifyContent: "center", maxHeight: 160, overflow: "hidden", width: 760 }}>
            <span style={{ fontSize: 36, fontWeight: 400, lineHeight: 1.5, color: backgroundImageUrl ? "rgba(203,213,225,0.92)" : palette.subtextColor, fontFamily: "sans-serif", textAlign: "center" }}>
              {subtext}
            </span>
          </div>
        ) : null}

        {ctaText ? (
          <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: "10px", color: palette.highlightColor, fontFamily: "sans-serif", marginTop: 12 }}>
            {ctaText.toUpperCase()}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Split Panel Layout ───────────────────────────────────────────────────────
// Big stat/number on top, headline + bullets below

function SplitPanelLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, icon, bulletPoints = [], stats = [], palette, brandColor } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";

  // Use first stat as the hero number if available
  const heroStat = stats?.[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: FEED_W,
        height: FEED_H,
        padding: 80,
        position: "relative",
        overflow: "hidden",
        gap: 48,
        background: palette.background,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: brandColor, display: "flex" }} />

      {/* Hero number / icon at top */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          padding: "40px 48px",
          borderRadius: 24,
          background: glassBg,
          border: `1px solid ${glassBorder}`,
        }}
      >
        {heroStat ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 40, color: palette.subtextColor }}>{heroStat.label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontSize: 120, fontWeight: 900, color: palette.headlineColor, lineHeight: 1 }}>{heroStat.value}</span>
              {heroStat.change && (
                <span style={{ fontSize: 48, fontWeight: 700, color: "#4ade80" }}>{heroStat.change}</span>
              )}
            </div>
          </div>
        ) : icon ? (
          <span style={{ fontSize: 120, color: palette.highlightColor }}>{icon}</span>
        ) : (
          <span style={{ fontSize: 120, fontWeight: 900, color: palette.highlightColor, lineHeight: 1 }}>{headlineHighlight}</span>
        )}
      </div>

      {/* Headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 72, fontWeight: 900, color: palette.headlineColor, lineHeight: 1.1 }}>{headlineStart}</span>
        <span style={{ fontSize: 72, fontWeight: 900, color: palette.highlightColor, lineHeight: 1.1 }}>{headlineHighlight}</span>
      </div>

      {/* Bullets or subtext */}
      {bulletPoints.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bulletPoints.slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: palette.highlightColor, flexShrink: 0 }} />
              <span style={{ fontSize: 44, color: palette.subtextColor }}>{b}</span>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 48, color: palette.subtextColor, lineHeight: 1.4 }}>{subtext}</span>
      )}
    </div>
  );
}

// ─── Data Card Layout ─────────────────────────────────────────────────────────
// Stats-focused: context label, hero metric, stat cards grid

function DataCardLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, stats = [], metricValue, metricUnit, metricStatus, progressPercent, palette, brandColor } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: FEED_W,
        height: FEED_H,
        padding: 80,
        position: "relative",
        overflow: "hidden",
        gap: 40,
        background: palette.background,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: brandColor, display: "flex" }} />

      {/* Context label */}
      <span style={{ fontSize: 40, fontWeight: 500, color: palette.subtextColor }}>{headlineStart}</span>

      {/* Hero metric */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 160, fontWeight: 900, color: palette.headlineColor, lineHeight: 0.9 }}>
          {metricValue ?? headlineHighlight}
        </span>
        {metricUnit && <span style={{ fontSize: 56, color: palette.subtextColor }}>{metricUnit}</span>}
        {metricStatus && (
          <div style={{ display: "flex", padding: "12px 28px", borderRadius: 100, background: palette.ctaBackground }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: palette.ctaTextColor }}>{metricStatus}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", width: "100%", height: 12, borderRadius: 6, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ display: "flex", width: `${progressPercent ?? 65}%`, height: "100%", background: palette.highlightColor, borderRadius: 6 }} />
      </div>

      {/* Stats grid */}
      {stats.length > 0 && (
        <div style={{ display: "flex", gap: 20 }}>
          {stats.slice(0, 3).map((stat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "32px 36px",
                borderRadius: 20,
                background: glassBg,
                border: `1px solid ${glassBorder}`,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32, color: palette.subtextColor }}>{stat.label}</span>
              <span style={{ fontSize: 56, fontWeight: 800, color: palette.headlineColor, lineHeight: 1 }}>{stat.value}</span>
              {stat.change && <span style={{ fontSize: 28, color: "#4ade80" }}>{stat.change}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Subtext */}
      <span style={{ fontSize: 44, color: palette.subtextColor, lineHeight: 1.4 }}>{subtext}</span>
    </div>
  );
}

// ─── Device Showcase Layout ───────────────────────────────────────────────────
// The ONLY layout where the image is the subject, not a backdrop. A real app
// screenshot sits contain-fit inside a phone frame at true aspect ratio — no
// cover-crop, no dark scrim. Text lives beside it, never on top of it.
// backgroundImageUrl carries the screenshot here (same prop, different job).

const SCREEN_W = 440;                              // 9:19.5 phone screen at this canvas size
const SCREEN_H = Math.round(SCREEN_W / 0.4615);    // 953 — fits the 4:5 canvas with room to spare
const FRAME_PAD = 12;

function DeviceShowcaseLayout(props: AdTemplateProps & { palette: DesignPalette }) {
  const { headlineStart, headlineHighlight, subtext, socialProof, ctaText, palette, backgroundImageUrl, logoUrl } = props;
  const isLight = palette.category === "light";
  const mutedColor = isLight ? "rgba(15,23,42,0.55)" : "rgba(203,213,225,0.62)";
  // The screenshot competes for attention here, so the headline needs more weight
  // than the brand's extralight display setting. 600 is the Brand Kit's max weight.
  const headlineWeight = Math.max(palette.headlineWeight ?? 700, 600);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: FEED_W,
        height: FEED_H,
        padding: "56px 52px",
        gap: 36,
        position: "relative",
        overflow: "hidden",
        background: palette.background,
      }}
    >
      {logoUrl && (
        <img src={logoUrl} style={{ position: "absolute", top: 44, left: 52, height: 38, objectFit: "contain", display: "flex" }} />
      )}

      {/* Text column — canvas width minus horizontal padding, gap, and the phone */}
      <div style={{ display: "flex", flexDirection: "column", width: FEED_W - 104 - 36 - (SCREEN_W + FRAME_PAD * 2), gap: 26 }}>
        {socialProof ? (
          <span style={{ fontSize: 24, fontWeight: 400, letterSpacing: "8px", color: mutedColor, fontFamily: "sans-serif" }}>
            {socialProof.toUpperCase()}
          </span>
        ) : null}

        <div style={{ display: "flex", maxHeight: 400, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", width: "100%" }}>
            <span style={{ fontSize: 58, fontWeight: headlineWeight, lineHeight: 1.14, color: palette.headlineColor, fontFamily: "sans-serif" }}>
              {headlineStart + "\u00A0"}
            </span>
            <span style={{ fontSize: 58, fontWeight: headlineWeight, lineHeight: 1.14, color: palette.highlightColor, fontFamily: "sans-serif" }}>
              {headlineHighlight}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", width: 56, height: 3, background: palette.highlightColor, borderRadius: 2 }} />

        {subtext ? (
          <div style={{ display: "flex", maxHeight: 220, overflow: "hidden", width: "100%" }}>
            <span style={{ fontSize: 32, fontWeight: 400, lineHeight: 1.45, color: palette.subtextColor, fontFamily: "sans-serif" }}>
              {subtext}
            </span>
          </div>
        ) : null}

        {ctaText ? (
          <div style={{ display: "flex", marginTop: 8, alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", width: 48, height: 1, background: `${palette.highlightColor}80` }} />
            <span style={{ fontSize: 24, fontWeight: 400, letterSpacing: "8px", color: palette.highlightColor, fontFamily: "sans-serif" }}>
              {ctaText.toUpperCase()}
            </span>
          </div>
        ) : null}
      </div>

      {/* Phone frame — contain-fit so the whole screen is visible and undimmed */}
      <div
        style={{
          display: "flex",
          width: SCREEN_W + FRAME_PAD * 2,
          height: SCREEN_H + FRAME_PAD * 2,
          padding: FRAME_PAD,
          borderRadius: 52,
          background: "#05050a",
          border: "2px solid rgba(255,255,255,0.16)",
          overflow: "hidden",
        }}
      >
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            style={{ width: SCREEN_W, height: SCREEN_H, objectFit: "contain", borderRadius: 40, display: "flex" }}
          />
        ) : (
          // No screenshot yet — an empty screen still reads as "phone" in the picker thumbnail
          <div style={{ display: "flex", width: SCREEN_W, height: SCREEN_H, borderRadius: 40, background: "#0a0a12" }} />
        )}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function AdTemplateTakumi(props: AdTemplateProps) {
  const layout = props.layoutStyle ?? "bold-statement";
  const palette = props.palette ?? getPalette(DEFAULT_PALETTE_ID);
  const shared = { palette, brandColor: props.brandColor ?? "#6366f1" };

  if (layout === "split-panel") return <SplitPanelLayout {...props} {...shared} />;
  if (layout === "data-card") return <DataCardLayout {...props} {...shared} />;
  if (layout === "editorial-lower") return <EditorialLowerLayout {...props} palette={palette} />;
  if (layout === "centered-minimal") return <CenteredMinimalLayout {...props} palette={palette} />;
  if (layout === "device-showcase") return <DeviceShowcaseLayout {...props} palette={palette} />;
  return <BoldStatementLayout {...props} {...shared} />;
}
