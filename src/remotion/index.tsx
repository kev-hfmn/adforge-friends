import { Composition, registerRoot } from "remotion";
import { ReelComposition } from "./compositions/ReelComposition";
import React from "react";

// 1080x1920 @ 30fps, 3 seconds = 90 frames
const REEL_DURATION_FRAMES = 90;
const REEL_FPS = 30;

function RemotionRoot() {
  return (
    <>
      <Composition
        id="AdReel"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ReelComposition as any}
        durationInFrames={REEL_DURATION_FRAMES}
        fps={REEL_FPS}
        width={1080}
        height={1920}
        defaultProps={{
          headlineStart: "Turn your data into",
          headlineHighlight: "revenue insights",
          subtext: "Stop wasting hours on complex SQL queries.",
          boldPhrases: [],
          backgroundPreset: "dark-gradient" as const,
          stats: [
            { label: "Revenue", value: "$47.2K", change: "+12.5%" },
            { label: "Users", value: "1,247", change: "+8.3%" },
          ],
          socialProof: "Join 500+ GTM teams",
          ctaText: "Get Started Free",
          brandColor: "#6366f1",
        }}
      />
    </>
  );
}

registerRoot(RemotionRoot);
