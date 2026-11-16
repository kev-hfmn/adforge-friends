// Caption checks for every project. Pure: no database.
import { numbersIn } from "./kb-types";

export const STUDIO_CHANNELS = ["instagram", "facebook", "tiktok", "x"] as const;
export type StudioChannel = (typeof STUDIO_CHANNELS)[number];

export const CHANNEL_LIMITS: Record<StudioChannel, number> = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 4000,
  x: 280,
};

export const HASHTAG_CAP = 5;

export type StudioLevel = "block" | "warn";

export type StudioIssue = {
  level: StudioLevel;
  code: string;
  message: string;
  channel?: StudioChannel;
};

export type BannedPhrase = {
  pattern: string;
  reason: string;
  replacement?: string;
};

export type ChannelDraft = {
  caption?: string | null;
  hashtags?: string | null;
  firstComment?: string | null;
};

export type StudioFormat = "photo" | "carousel" | "reel" | "other";

export type StudioCheckInput = {
  caption: string;
  hashtags: string;
  firstComment?: string;
  variants?: Partial<Record<StudioChannel, ChannelDraft>>;
  /** Exact number tokens from this project's fact entries. */
  allowedNumbers: string[];
  /** Checked facts for this post. Numbers in here count as sourced. */
  allowedText?: string;
  banned?: BannedPhrase[];
  voiceRules?: string[];
  format: StudioFormat;
  /** One entry per image. Empty string means that image has no alt text. */
  altTexts: string[];
  /** Hashtags already stored. An old post over the cap warns until the tags change. */
  storedHashtags?: string | null;
  /**
   * Photos and carousels block on missing alt once the studio has saved them.
   * Older posts only warn, so an existing week can still be approved.
   */
  altRequired?: boolean;
  /** Instagram, unless the post is Facebook-only. */
  primary?: "instagram" | "facebook";
};

const SYMPTOM_QUESTION = /do you feel|who else felt|did you notice|are you feeling/i;

export function replaceDashes(value: string): { text: string; count: number } {
  let count = 0;
  const text = value.replace(/[\u2014\u2013]/g, () => {
    count += 1;
    return ", ";
  });
  return { text, count };
}

export function hashtagCount(text: string): number {
  return (text.match(/#[^\s#]+/g) ?? []).length;
}

export function parseAltTexts(value: string | null | undefined): string[] | null {
  if (value == null || value === "") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed;
  } catch {
    // A single plain-text alt from before the studio.
  }
  return [value];
}

export function resolvedFields(
  main: { caption: string; hashtags: string },
  variant?: ChannelDraft | null,
): { caption: string; hashtags: string } {
  return {
    caption: variant?.caption != null ? variant.caption : main.caption,
    hashtags: variant?.hashtags != null ? variant.hashtags : main.hashtags,
  };
}

export function channelBody(caption: string, hashtags: string): string {
  return [caption, hashtags].filter(Boolean).join("\n\n");
}

function allowedSet(numbers: string[], allowedText: string): Set<string> {
  return new Set([...numbers, ...numbersIn(allowedText)]);
}

function push(issues: StudioIssue[], issue: StudioIssue) {
  if (issues.some((item) => item.code === issue.code && item.channel === issue.channel)) return;
  issues.push(issue);
}

function voiceIssues(text: string, rules: string[]): StudioIssue[] {
  const issues: StudioIssue[] = [];
  for (const rule of rules) {
    const wordLimit = rule.match(/(\d+)\s+words/i);
    if (wordLimit) {
      const max = Number(wordLimit[1]);
      const long = text
        .split(/[.!?]+/)
        .some((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length > max);
      if (long)
        push(issues, {
          level: "warn",
          code: "voice:sentence",
          message: `A sentence is over ${max} words.`,
        });
    }
    if (/exclamation/i.test(rule) && text.includes("!"))
      push(issues, {
        level: "warn",
        code: "voice:exclamation",
        message: "Exclamation mark. The voice rules leave it out.",
      });
    if (/no first person|avoid first person|third person/i.test(rule) && /\b(I|I'm|I've|I'd|my)\b/.test(text))
      push(issues, {
        level: "warn",
        code: "voice:person",
        message: "First person. This voice rule stays in the third person.",
      });
    if (/symptom/i.test(rule) && SYMPTOM_QUESTION.test(text))
      push(issues, {
        level: "block",
        code: "voice:symptom",
        message: "Symptom question. Ask something else, or cut the question.",
      });
  }
  return issues;
}

/** Blocks stop Approve. Warnings do not. A warning can be overridden. A block cannot. */
export function checkStudioCopy(input: StudioCheckInput): StudioIssue[] {
  const issues: StudioIssue[] = [];
  const primary = input.primary ?? "instagram";
  const main = channelBody(input.caption, input.hashtags);
  const allowed = allowedSet(input.allowedNumbers, input.allowedText ?? "");
  const texts: { channel?: StudioChannel; text: string }[] = [
    { text: [main, input.firstComment ?? ""].filter(Boolean).join("\n") },
  ];

  for (const channel of STUDIO_CHANNELS) {
    const variant = input.variants?.[channel];
    const fields = resolvedFields(
      { caption: input.caption, hashtags: input.hashtags },
      variant,
    );
    const own = variant?.caption != null || variant?.hashtags != null;
    const body = channelBody(fields.caption, fields.hashtags);
    if (variant?.firstComment) texts.push({ channel, text: variant.firstComment });
    if (own) texts.push({ channel, text: body });
    if (own && Array.from(body).length > CHANNEL_LIMITS[channel])
      push(issues, {
        level: "block",
        code: `length:${channel}`,
        channel,
        message: `${channelName(channel)} caption is over ${CHANNEL_LIMITS[channel].toLocaleString()} characters.`,
      });
    if (channel === "facebook" && /link in bio/i.test(body))
      push(issues, {
        level: "warn",
        code: "link-in-bio",
        channel: "facebook",
        message: "Facebook can use a real link. This still says link in bio.",
      });
  }

  const primaryBody =
    primary === "facebook"
      ? channelBody(
          resolvedFields({ caption: input.caption, hashtags: input.hashtags }, input.variants?.facebook).caption,
          resolvedFields({ caption: input.caption, hashtags: input.hashtags }, input.variants?.facebook).hashtags,
        )
      : main;
  if (Array.from(primaryBody).length > CHANNEL_LIMITS[primary])
    push(issues, {
      level: "block",
      code: `length:${primary}`,
      channel: primary,
      message: `${channelName(primary)} caption is over ${CHANNEL_LIMITS[primary].toLocaleString()} characters.`,
    });

  const tags = primary === "facebook" && input.variants?.facebook?.hashtags != null
    ? input.variants.facebook.hashtags
    : input.hashtags;
  const tagCount = hashtagCount(primary === "facebook" ? primaryBody : `${input.caption}\n${input.hashtags}`);
  const storedCount = hashtagCount(input.storedHashtags ?? "");
  const tagsChanged = (input.storedHashtags ?? "") !== (tags ?? "");
  if (tagCount > HASHTAG_CAP) {
    const legacy = !tagsChanged && storedCount > HASHTAG_CAP;
    push(issues, {
      level: legacy ? "warn" : "block",
      code: legacy ? "hashtags:legacy" : "hashtags",
      message: legacy
        ? `${tagCount} hashtags. The cap is ${HASHTAG_CAP}. This post keeps them until you edit the tags.`
        : `More than ${HASHTAG_CAP} hashtags.`,
    });
  }

  const scanned = texts.map((item) => item.text).join("\n");
  if (/[\u2014\u2013]/.test(scanned))
    push(issues, {
      level: "block",
      code: "dash",
      message: "Em dash or en dash. Use a comma, a period, or a colon.",
    });

  for (const token of numbersIn(scanned)) {
    if (allowed.has(token)) continue;
    push(issues, {
      level: "block",
      code: `number:${token}`,
      message: `No source in the hub for ${token}.`,
    });
  }

  for (const ban of input.banned ?? []) {
    const pattern = ban.pattern.trim();
    if (pattern.length < 2 || pattern === "em dash" || pattern === "en dash") continue;
    const found = scanned.toLowerCase().includes(pattern.toLowerCase());
    if (!found) continue;
    const replacement = ban.replacement ? ` Use ${ban.replacement}.` : "";
    push(issues, {
      level: "block",
      code: `banned:${pattern.toLowerCase()}`,
      message: `${pattern}: ${ban.reason}.${replacement}`,
    });
  }

  issues.push(...voiceIssues(scanned, input.voiceRules ?? []));

  const head = Array.from(primaryBody).slice(0, 125).join("");
  if (Array.from(primaryBody).length > 125 && !/[.!?]/.test(head))
    push(issues, {
      level: "warn",
      code: "first125",
      channel: primary,
      message: "The first 125 characters are what shows before more. End that part on a complete sentence.",
    });

  const missingAlt = input.altTexts.length === 0 || input.altTexts.some((alt) => !alt.trim());
  if (missingAlt) {
    const blockAlt = (input.format === "photo" || input.format === "carousel") && input.altRequired !== false;
    push(issues, {
      level: blockAlt ? "block" : "warn",
      code: "alt",
      message: blockAlt
        ? "Alt text missing. Add it for each image before approving."
        : "Alt text missing.",
    });
  }

  return issues;
}

export function blockingIssues(issues: StudioIssue[], overrides: string[] = []): StudioIssue[] {
  const hidden = new Set(overrides);
  return issues.filter((issue) => issue.level === "block" || !hidden.has(issue.code));
}

export function blocksOf(issues: StudioIssue[]): StudioIssue[] {
  return issues.filter((issue) => issue.level === "block");
}

export function channelName(channel: StudioChannel): string {
  if (channel === "instagram") return "Instagram";
  if (channel === "facebook") return "Facebook";
  if (channel === "tiktok") return "TikTok";
  return "X";
}

export function studioFormat(templateType: string | null | undefined): StudioFormat {
  if (templateType === "reel") return "reel";
  if (templateType === "carousel") return "carousel";
  if (templateType === "ad") return "photo";
  return "other";
}
