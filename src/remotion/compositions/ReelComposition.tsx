import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { AdTemplateProps } from "@/components/templates/AdTemplateTakumi";

const bgPresets: Record<string, string> = {
  "dark-gradient": "linear-gradient(180deg, #1a1a2e 0%, #16162a 50%, #0a0a0a 100%)",
  "light-blue": "linear-gradient(180deg, #1a1a3e 0%, #1e3a5f 50%, #0a0a2a 100%)",
  "rainbow": "linear-gradient(180deg, #1a0a2e 0%, #2a1a3e 50%, #0a1a2e 100%)",
  "purple-dots": "linear-gradient(180deg, #2a1a3e 0%, #1a1a2e 50%, #0a0a1a 100%)",
  "white": "#ffffff",
};

export function ReelComposition({
  headlineStart = "Turn your data into",
  headlineHighlight = "revenue insights",
  subtext = "Stop wasting hours on complex SQL queries.",
  backgroundPreset = "dark-gradient",
  stats = [],
  socialProof = "Join 500+ GTM teams",
  ctaText = "Get Started Free",
  brandColor = "#6366f1",
}: AdTemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isLight = backgroundPreset === "white";
  const textColor = isLight ? "#111827" : "#ffffff";
  const subtextColor = isLight ? "#6b7280" : "#9ca3af";
  const background = bgPresets[backgroundPreset] || bgPresets["dark-gradient"];

  // Animation helpers
  const fadeIn = (startFrame: number, duration = 20) =>
    interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const slideUp = (startFrame: number, duration = 20) => {
    const progress = spring({ frame: frame - startFrame, fps, config: { stiffness: 80, damping: 20 } });
    return interpolate(progress, [0, 1], [40, 0]);
  };

  const scale = (startFrame: number) =>
    spring({ frame: frame - startFrame, fps, config: { stiffness: 100, damping: 18 } });

  return (
    <AbsoluteFill
      style={{
        background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-evenly",
        padding: "100px 80px",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Background glow blobs */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 500,
          height: 500,
          borderRadius: 250,
          background: `radial-gradient(circle, ${brandColor}33 0%, transparent 70%)`,
          opacity: fadeIn(0),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: 200,
          background: `radial-gradient(circle, ${brandColor}18 0%, transparent 70%)`,
          opacity: fadeIn(5),
        }}
      />

      {/* Social proof badge — enters at frame 0 */}
      {socialProof && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 32px",
            borderRadius: 100,
            border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`,
            background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
            opacity: fadeIn(0, 15),
            transform: `translateY(${slideUp(0, 15)}px)`,
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {["#4ade80", "#22c55e", "#16a34a"].map((c, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 28, fontWeight: 500, color: isLight ? "#374151" : "#d1d5db" }}>
            {socialProof}
          </span>
        </div>
      )}

      {/* Headline — enters at frame 10 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: fadeIn(10, 20),
          transform: `translateY(${slideUp(10, 20)}px)`,
        }}
      >
        <span style={{ fontSize: 108, fontWeight: 800, textAlign: "center", lineHeight: 1.1, color: textColor }}>
          {headlineStart}
        </span>
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            backgroundImage: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {headlineHighlight}
        </span>
      </div>

      {/* Subtext — enters at frame 20 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          maxWidth: 900,
          opacity: fadeIn(20, 20),
          transform: `translateY(${slideUp(20, 20)}px)`,
        }}
      >
        <p style={{ fontSize: 42, textAlign: "center", lineHeight: 1.5, margin: 0, color: subtextColor }}>
          {subtext}
        </p>
      </div>

      {/* Stats — staggered from frame 30 */}
      {stats && stats.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
          {stats.map((stat, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "32px 48px",
                borderRadius: 24,
                background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"}`,
                opacity: fadeIn(30 + i * 8, 15),
                transform: `translateY(${slideUp(30 + i * 8, 15)}px) scale(${interpolate(
                  scale(30 + i * 8),
                  [0, 1],
                  [0.95, 1]
                )})`,
              }}
            >
              <span style={{ fontSize: 30, color: isLight ? "#6b7280" : "#9ca3af" }}>{stat.label}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontSize: 56, fontWeight: 700, color: textColor }}>{stat.value}</span>
                {stat.change && (
                  <span style={{ fontSize: 28, color: "#4ade80" }}>{stat.change}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div />
      )}

      {/* CTA — enters at frame 50 */}
      {ctaText ? (
        <div
          style={{
            display: "flex",
            padding: "36px 80px",
            borderRadius: 100,
            background: brandColor,
            opacity: fadeIn(50, 15),
            transform: `scale(${interpolate(scale(50), [0, 1], [0.9, 1])})`,
          }}
        >
          <span style={{ fontSize: 44, fontWeight: 600, color: "#ffffff" }}>{ctaText}</span>
        </div>
      ) : (
        <div />
      )}
    </AbsoluteFill>
  );
}
