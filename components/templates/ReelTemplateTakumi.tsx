import React from "react";
import type { AdTemplateProps, LayoutStyle } from "./AdTemplateTakumi";
import { DesignPalette, getPalette, DEFAULT_PALETTE_ID } from "@/lib/design-palettes";

// ─── Bold Statement Reel ──────────────────────────────────────────────────────
// Full-bleed 1080×1920: huge hook + supporting copy + CTA, centered

function BoldStatementLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, socialProof, ctaText, stats = [], palette, brandColor, backgroundImageUrl, logoUrl } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: 1080,
        height: 1920,
        padding: "120px 88px",
        position: "relative",
        overflow: "hidden",
        background: palette.background,
      }}
    >
      {/* Background image with dark overlay */}
      {backgroundImageUrl && (
        <>
          <img src={backgroundImageUrl} style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, objectFit: "cover", display: "flex" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, background: "rgba(0,0,0,0.65)", display: "flex" }} />
        </>
      )}


      {/* Brand accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: brandColor, display: "flex" }} />

      {/* Logo */}
      {logoUrl && (
        <img src={logoUrl} style={{ position: "absolute", top: 60, left: 88, height: 64, objectFit: "contain", display: "flex" }} />
      )}

      {/* Inner content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 40,
        }}
      >
        {/* Social proof */}
        {socialProof ? (
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 36px",
                borderRadius: 100,
                background: glassBg,
                border: `1px solid ${glassBorder}`,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#4ade80", "#22c55e", "#16a34a"].map((c, i) => (
                  <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c, display: "flex" }} />
                ))}
              </div>
              <span style={{ fontSize: 36, fontWeight: 500, color: palette.subtextColor }}>{socialProof}</span>
            </div>
          </div>
        ) : null}

        {/* Headline — capped at 4 lines */}
        <div style={{ display: "flex", maxHeight: 420, overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", width: "100%" }}>
            <span
              style={{
                fontSize: 96,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-1.5px",
                color: palette.headlineColor,
              }}
            >
              {headlineStart}&nbsp;
            </span>
            <span
              style={{
                fontSize: 96,
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-1.5px",
                color: palette.highlightColor,
              }}
            >
              {headlineHighlight}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", width: 80, height: 5, background: palette.highlightColor, borderRadius: 3 }} />

        {/* Subtext — capped at 4 lines */}
        <div style={{ display: "flex", maxHeight: 240, overflow: "hidden", width: "100%" }}>
          <span
            style={{
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1.45,
              color: palette.subtextColor,
            }}
          >
            {subtext}
          </span>
        </div>

        {/* Stats cards */}
        {stats.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            {stats.slice(0, 3).map((stat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "36px 48px",
                  borderRadius: 20,
                  background: glassBg,
                  border: `1px solid ${glassBorder}`,
                }}
              >
                <span style={{ fontSize: 36, color: palette.subtextColor }}>{stat.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span style={{ fontSize: 64, fontWeight: 800, color: palette.headlineColor, lineHeight: 1 }}>{stat.value}</span>
                  {stat.change && <span style={{ fontSize: 36, color: "#4ade80" }}>{stat.change}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        {ctaText ? (
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                padding: "32px 64px",
                borderRadius: 18,
                background: palette.ctaBackground,
              }}
            >
              <span style={{ fontSize: 48, fontWeight: 700, color: palette.ctaTextColor }}>{ctaText}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Split Panel Reel ─────────────────────────────────────────────────────────
// Top half: big visual stat/number. Bottom half: headline + bullets.

function SplitPanelLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, icon, bulletPoints = [], stats = [], palette, brandColor } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";
  const heroStat = stats?.[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1080,
        height: 1920,
        padding: 80,
        position: "relative",
        overflow: "hidden",
        gap: 60,
        background: palette.background,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: brandColor, display: "flex" }} />

      {/* Hero zone */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "60px 60px",
          borderRadius: 32,
          background: glassBg,
          border: `1px solid ${glassBorder}`,
          flex: 1,
        }}
      >
        {heroStat ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 48, color: palette.subtextColor }}>{heroStat.label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span style={{ fontSize: 180, fontWeight: 900, color: palette.headlineColor, lineHeight: 0.9 }}>{heroStat.value}</span>
              {heroStat.change && <span style={{ fontSize: 64, fontWeight: 700, color: "#4ade80" }}>{heroStat.change}</span>}
            </div>
          </div>
        ) : icon ? (
          <span style={{ fontSize: 180 }}>{icon}</span>
        ) : (
          <span style={{ fontSize: 160, fontWeight: 900, color: palette.highlightColor, lineHeight: 1 }}>{headlineHighlight}</span>
        )}
      </div>

      {/* Text zone */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 88, fontWeight: 900, color: palette.headlineColor, lineHeight: 1.05 }}>{headlineStart}</span>
          <span style={{ fontSize: 88, fontWeight: 900, color: palette.highlightColor, lineHeight: 1.05 }}>{headlineHighlight}</span>
        </div>

        <div style={{ display: "flex", width: 80, height: 5, background: palette.highlightColor, borderRadius: 3 }} />

        {bulletPoints.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {bulletPoints.slice(0, 4).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: palette.highlightColor, flexShrink: 0 }} />
                <span style={{ fontSize: 52, color: palette.subtextColor, lineHeight: 1.3 }}>{b}</span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 56, color: palette.subtextColor, lineHeight: 1.45 }}>{subtext}</span>
        )}
      </div>
    </div>
  );
}

// ─── Data Card Reel ───────────────────────────────────────────────────────────

function DataCardLayout(props: AdTemplateProps & { palette: DesignPalette; brandColor: string }) {
  const { headlineStart, headlineHighlight, subtext, stats = [], metricValue, metricUnit, metricStatus, progressPercent, palette, brandColor } = props;
  const isLight = palette.category === "light";
  const glassBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";
  const glassBorder = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1080,
        height: 1920,
        padding: 80,
        position: "relative",
        overflow: "hidden",
        gap: 48,
        background: palette.background,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: brandColor, display: "flex" }} />

      <span style={{ fontSize: 48, fontWeight: 500, color: palette.subtextColor }}>{headlineStart}</span>

      {/* Hero metric */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, flexWrap: "wrap" }}>
          <span style={{ fontSize: 200, fontWeight: 900, color: palette.headlineColor, lineHeight: 0.9 }}>
            {metricValue ?? headlineHighlight}
          </span>
          {metricUnit && <span style={{ fontSize: 64, color: palette.subtextColor }}>{metricUnit}</span>}
        </div>
        {metricStatus && (
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", padding: "16px 36px", borderRadius: 100, background: palette.ctaBackground }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: palette.ctaTextColor }}>{metricStatus}</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", width: "100%", height: 16, borderRadius: 8, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ display: "flex", width: `${progressPercent ?? 65}%`, height: "100%", background: palette.highlightColor, borderRadius: 8 }} />
      </div>

      {/* Stats — vertical stack for reel */}
      {stats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {stats.slice(0, 4).map((stat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "44px 52px",
                borderRadius: 24,
                background: glassBg,
                border: `1px solid ${glassBorder}`,
              }}
            >
              <span style={{ fontSize: 40, color: palette.subtextColor }}>{stat.label}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontSize: 64, fontWeight: 800, color: palette.headlineColor, lineHeight: 1 }}>{stat.value}</span>
                {stat.change && <span style={{ fontSize: 36, color: "#4ade80" }}>{stat.change}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <span style={{ fontSize: 48, color: palette.subtextColor, lineHeight: 1.45 }}>{subtext}</span>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function ReelTemplateTakumi(props: AdTemplateProps) {
  const layout = props.layoutStyle ?? "bold-statement";
  const palette = props.palette ?? getPalette(DEFAULT_PALETTE_ID);
  const shared = { palette, brandColor: props.brandColor ?? "#6366f1" };

  if (layout === "split-panel") return <SplitPanelLayout {...props} {...shared} />;
  if (layout === "data-card") return <DataCardLayout {...props} {...shared} />;
  return <BoldStatementLayout {...props} {...shared} />;
}
