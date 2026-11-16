export interface CarouselFramework {
  id: string;
  name: string;
  description: string;   // shown as subtitle in picker
  defaultSlideCount: number; // pre-fills slide count control (4-10)
  slides: string[];      // per-slide purpose; index = slide number; must have >= defaultSlideCount entries
  bgPalette: string[];   // curated background preset sequence; cycles if slideCount > palette length
}

export const CAROUSEL_FRAMEWORKS: CarouselFramework[] = [
  {
    id: "pattern-interrupt",
    name: "Pattern Interrupt",
    description: "Disrupt default thinking with a surprising opening",
    defaultSlideCount: 5,
    bgPalette: ["dark-gradient", "rainbow", "purple-dots", "rainbow", "dark-gradient", "purple-dots", "rainbow"],
    slides: [
      "Shocking or counterintuitive statement that stops the scroll",
      "Why the common belief is wrong — poke the assumption",
      "The real truth or overlooked insight",
      "Concrete proof or example that validates the new perspective",
      "Call to action that ties back to the insight",
      "Bonus: reinforce the insight with a memorable takeaway",
      "Final nudge — reminder of what changes if they act now",
    ],
  },
  {
    id: "myth-busting",
    name: "Myth Busting",
    description: "Expose a common misconception and deliver the real truth",
    defaultSlideCount: 6,
    bgPalette: ["dark-gradient", "purple-dots", "rainbow", "purple-dots", "rainbow", "dark-gradient", "purple-dots"],
    slides: [
      "State the common myth as a bold hook",
      "Why people believe it — validate the misconception",
      "The actual truth — deliver the reframe",
      "Evidence #1 that proves the truth",
      "Evidence #2 that proves the truth",
      "Call to action — what to do with this new knowledge",
      "Bonus myth or takeaway that reinforces the theme",
    ],
  },
  {
    id: "authority-builder",
    name: "Authority Builder",
    description: "Establish expertise and build trust before the ask",
    defaultSlideCount: 5,
    bgPalette: ["dark-gradient", "light-blue", "dark-gradient", "light-blue", "dark-gradient", "light-blue", "dark-gradient"],
    slides: [
      "Credibility hook — lead with a result or bold claim you can back up",
      "Problem statement — what pain point you solve",
      "Expert insight or framework only insiders know",
      "Proof or results that validate the insight",
      "Call to action — take the next step with an expert",
      "Social proof stack — quotes, numbers, or logos",
      "Reassurance — reduce perceived risk",
    ],
  },
  {
    id: "soft-story-sell",
    name: "Soft Story Sell",
    description: "Tell a relatable story that leads naturally to the offer",
    defaultSlideCount: 6,
    bgPalette: ["dark-gradient", "purple-dots", "rainbow", "rainbow", "light-blue", "dark-gradient", "light-blue"],
    slides: [
      "Relatable opening — set the scene before the struggle",
      "The struggle — make the reader feel the pain",
      "The turning point — discovery of the solution",
      "The transformation — life after finding the solution",
      "The result — specific, measurable outcome",
      "Call to action — invite them into the same transformation",
      "Post-CTA reassurance or bonus incentive",
    ],
  },
  {
    id: "direct-hard-sell",
    name: "Direct Hard Sell",
    description: "Bold value proposition with an urgent call to action",
    defaultSlideCount: 4,
    bgPalette: ["dark-gradient", "rainbow", "rainbow", "dark-gradient", "rainbow", "dark-gradient", "rainbow"],
    slides: [
      "Bold value proposition — lead with the biggest benefit, no warm-up",
      "Key benefit #1 — one clear, specific advantage",
      "Key benefit #2 plus social proof",
      "Urgent call to action — create a reason to act now",
      "Objection handler — address the most common hesitation",
      "Secondary CTA or guarantee",
      "Final urgency reminder",
    ],
  },
  {
    id: "value-bomb",
    name: "Value Bomb",
    description: "Deliver so much value the reader feels compelled to save and share",
    defaultSlideCount: 7,
    bgPalette: ["dark-gradient", "purple-dots", "rainbow", "dark-gradient", "purple-dots", "rainbow", "dark-gradient", "purple-dots", "rainbow", "dark-gradient"],
    slides: [
      "Promise slide — hook with the number of tips and the transformation",
      "Tip #1 — actionable, specific, immediately useful",
      "Tip #2 — builds on or contrasts with Tip #1",
      "Tip #3 — the one most people overlook",
      "Tip #4 — advanced or contrarian insight",
      "Tip #5 — the easiest quick win",
      "Save and follow CTA — tell them to save for later and follow for more",
      "Bonus tip or tool recommendation",
      "Recap slide — summarize all tips in one glance",
      "Final CTA — link in bio or DM for more",
    ],
  },
  {
    id: "belief-shifting",
    name: "Belief Shifting",
    description: "Challenge a limiting belief and install a more empowering one",
    defaultSlideCount: 5,
    bgPalette: ["purple-dots", "dark-gradient", "rainbow", "purple-dots", "dark-gradient", "rainbow", "dark-gradient"],
    slides: [
      "State the old limiting belief directly — make readers nod in recognition",
      "Why that belief is holding them back — cost of inaction",
      "Introduce the new empowering perspective",
      "Evidence or example that validates the new belief",
      "Call to action based on the new belief — what to do now",
      "Reinforce the shift — a memorable reframe or quote",
      "Follow-up nudge — next belief to examine",
    ],
  },
  {
    id: "before-after",
    name: "Before/After",
    description: "Contrast a painful before state with a compelling after state",
    defaultSlideCount: 4,
    bgPalette: ["purple-dots", "dark-gradient", "rainbow", "light-blue", "dark-gradient", "rainbow", "light-blue"],
    slides: [
      "The before state — describe the painful situation in vivid detail",
      "What changed — the intervention, decision, or tool that made the difference",
      "The after state — the desired outcome, described specifically and emotionally",
      "How to get there — clear CTA showing how they can have the same transformation",
      "Social proof — someone else's before/after to reinforce believability",
      "Objection buster — address why they might not believe it can happen for them",
      "Final CTA — urgency or next step",
    ],
  },
  {
    id: "listicle",
    name: "Listicle",
    description: "Numbered list format that drives saves and shares",
    defaultSlideCount: 7,
    bgPalette: ["dark-gradient", "purple-dots", "dark-gradient", "rainbow", "dark-gradient", "light-blue", "dark-gradient", "purple-dots", "rainbow", "dark-gradient"],
    slides: [
      "Hook slide — '7 things you need to know about [topic]' with a benefit promise",
      "Item 1 — surprising or counterintuitive to earn trust early",
      "Item 2 — practical and immediately actionable",
      "Item 3 — the one most people miss",
      "Item 4 — adds credibility or data",
      "Item 5 — relatable or emotionally resonant",
      "CTA and recap — save for later, follow for more, summarize the list",
      "Bonus item — give more than promised",
      "Follow-up resource or next step",
      "Final engagement prompt — ask a question to boost comments",
    ],
  },
  {
    id: "social-proof-stack",
    name: "Social Proof Stack",
    description: "Stack multiple proof points to build unstoppable credibility",
    defaultSlideCount: 5,
    bgPalette: ["dark-gradient", "light-blue", "dark-gradient", "light-blue", "rainbow", "dark-gradient", "light-blue"],
    slides: [
      "Bold claim hook — state the outcome others have achieved",
      "Customer proof #1 — specific result with a name or persona",
      "Customer proof #2 — different use case or audience segment",
      "Aggregated result or metric — the big number that captures all results",
      "Call to action — get the same result",
      "Guarantee or risk-reversal slide",
      "FAQ or objection handler",
    ],
  },
  {
    id: "app-tour",
    name: "App Tour (screenshots)",
    description: "Introduce the app with real screenshots — one screen per slide",
    defaultSlideCount: 5,
    bgPalette: ["dark-gradient", "dark-gradient", "dark-gradient", "dark-gradient", "dark-gradient", "dark-gradient", "dark-gradient"],
    slides: [
      "Hook — what the app is in one plain sentence, no feature list. This slide sets up the screens that follow",
      "The main screen — name what the reader is looking at and what the number/view means",
      "The second screen — the detail or history view, and why someone would open it",
      "The third screen — the thing that makes it trustworthy or different from lookalikes",
      "Call to action — where to get it, stated plainly with no urgency pressure",
      "One more screen — a smaller feature worth knowing about",
      "Honest limitation — what the app does not do, stated without apology",
    ],
  },
];

export const DEFAULT_FRAMEWORK_ID = "pattern-interrupt";

/** Screenshot-led frameworks: slides are your own uploads, so skip AI image
 * generation entirely and render in the phone-frame layout. */
export const SCREENSHOT_FRAMEWORK_IDS = ["app-tour"];

export function getFramework(id: string): CarouselFramework {
  return CAROUSEL_FRAMEWORKS.find((f) => f.id === id) ?? CAROUSEL_FRAMEWORKS[0];
}
