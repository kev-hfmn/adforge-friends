// Calendar math for Plan. Pure: no database, no network. Local dates go through
// localTimestamp so a daylight-saving week does not shift a post's clock time.
import { futureTime, timing, type Timing } from "./queue-rules";
import {
  localInput,
  localTimestamp,
  type WeeklySlot,
} from "./queue-schedule";
import {
  postLabel,
  queueKind,
  slidesFor,
  targetChannel,
  type QueuePost,
} from "./queue-view";
import { storedInsights } from "./queue-insights";

export const PLAN_VIEWS = ["week", "month", "day", "list", "grid"] as const;
export type PlanView = (typeof PLAN_VIEWS)[number];

export type PlanFormat = "reel" | "carousel" | "photo";
export type PlanChannelId = "instagram" | "facebook" | "tiktok";
export type PlanChannelState = "planned" | "sent" | "failed";
export type PlanStatusKey = "review" | "scheduled" | "posted" | "failed" | "claude";

export type PlanChannel = { id: PlanChannelId; state: PlanChannelState };
export type PlanCard = {
  id: string;
  at: number | null;
  day: string | null;
  minutes: number | null;
  time: string | null;
  label: string;
  caption: string;
  word: string;
  statusKey: PlanStatusKey;
  imagePath: string | null;
  format: PlanFormat;
  slides: number;
  channels: PlanChannel[];
  pillar: string | null;
  reach: number | null;
  sends: number | null;
  movable: boolean;
  notes: number;
  facebookOnly: boolean;
};

export type PlanSlot = {
  day: string;
  hour: number;
  time: string;
  at: number;
  label: string;
  kind: string;
};

export type PlanDay = {
  key: string;
  name: string;
  date: string;
  today: boolean;
  past: boolean;
  inMonth: boolean;
};

export type PlanEvent = {
  date: string;
  title: string;
  kind: string;
  source: string;
  url: string | null;
};

// Queue kinds that map to a content pillar id. Empty: pillars come from the brand kit.
const KIND_PILLAR: Record<string, string> = {};

const WORD: Record<string, string> = {
  scheduled: "Scheduled",
  due: "Due",
  proposed: "Needs your OK",
  "proposal-passed": "Time passed",
  unplanned: "Needs your OK",
  failed: "Failed",
  posted: "Posted",
  claude: "With Claude",
  "no-time": "No time",
};

export function parsePlanView(value: string | undefined): PlanView | null {
  return PLAN_VIEWS.includes(value as PlanView) ? (value as PlanView) : null;
}

export function parseDayKey(value: string | undefined): string | null {
  return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function shiftDay(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  return shiftDay(key, -((date.getUTCDay() + 6) % 7));
}

export function addMonths(key: string, count: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + count, 1, 12));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  let key = start;
  while (key <= end && days.length < 42) {
    days.push(key);
    key = shiftDay(key, 1);
  }
  return days;
}

const fmt = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(
    new Date(`${key}T12:00:00Z`),
  );

export function rangeTitle(start: string, end: string): string {
  const endLabel = fmt(end, { day: "numeric", month: "short" });
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${fmt(start, { day: "numeric" })} to ${endLabel}`;
  return `${fmt(start, { day: "numeric", month: "short" })} to ${endLabel}`;
}

export function periodOf(view: PlanView, anchor: string): {
  start: string;
  end: string;
  title: string;
  prev: string;
  next: string;
  grid: string[];
} {
  if (view === "day") {
    return {
      start: anchor,
      end: anchor,
      title: fmt(anchor, { weekday: "short", day: "numeric", month: "short" }),
      prev: shiftDay(anchor, -1),
      next: shiftDay(anchor, 1),
      grid: [anchor],
    };
  }
  if (view === "month") {
    const start = `${anchor.slice(0, 7)}-01`;
    const monthEnd = shiftDay(addMonths(start, 1), -1);
    const gridStart = mondayOf(start);
    const gridEnd = shiftDay(gridStart, 41);
    return {
      start: gridStart,
      end: gridEnd,
      title: fmt(start, { month: "long", year: "numeric" }),
      prev: addMonths(start, -1),
      next: addMonths(start, 1),
      grid: daysBetween(gridStart, gridEnd > monthEnd ? gridEnd : monthEnd),
    };
  }
  const start = mondayOf(anchor);
  const end = shiftDay(start, 6);
  return {
    start,
    end,
    title: view === "grid" ? "Profile grid" : rangeTitle(start, end),
    prev: shiftDay(start, -7),
    next: shiftDay(start, 7),
    grid: daysBetween(start, end),
  };
}

export function planDays(keys: string[], today: string, month: string | null): PlanDay[] {
  return keys.map((key) => ({
    key,
    name: fmt(key, { weekday: "short" }),
    date: fmt(key, { day: "numeric", month: "short" }),
    today: key === today,
    past: key < today,
    inMonth: month == null || key.slice(0, 7) === month,
  }));
}

export function clockMinutes(at: number): { day: string; time: string; minutes: number } {
  const input = localInput(at);
  const time = input.slice(11);
  const [hour, minute] = time.split(":").map(Number);
  return { day: input.slice(0, 10), time, minutes: hour * 60 + minute };
}

/** Drop position inside an hour row, snapped to 15 minutes. */
export function snapDrop(hour: number, offsetY: number, rowHeight: number): string {
  const span = rowHeight > 0 ? rowHeight : 1;
  const frac = Math.min(0.999, Math.max(0, offsetY / span));
  const minute = Math.min(45, Math.round((frac * 60) / 15) * 15);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function visibleHours(postMinutes: number[], slotHours: number[]): number[] {
  const hours = new Set<number>();
  for (const minutes of postMinutes) {
    if (Number.isFinite(minutes)) hours.add(Math.floor(minutes / 60));
  }
  for (const hour of slotHours) {
    if (hour >= 0 && hour < 24) hours.add(hour);
  }
  if (!hours.size) return [8, 18];
  return [...hours].sort((a, b) => a - b);
}

export function planFormat(
  post: Pick<QueuePost, "templateType" | "carouselSlides">,
): { format: PlanFormat; slides: number } {
  if (post.templateType === "reel") return { format: "reel", slides: 0 };
  if (post.templateType === "carousel") {
    const slides = slidesFor(post).length;
    return { format: "carousel", slides };
  }
  return { format: "photo", slides: 0 };
}

export function formatLabel(format: PlanFormat, slides: number): string {
  if (format === "carousel") return slides > 0 ? `Carousel ${slides}` : "Carousel";
  if (format === "reel") return "Reel";
  return "Photo";
}

export function pillarLabel(
  kind: string,
  pillars: readonly { id: string; label: string }[],
): string | null {
  const id = KIND_PILLAR[kind] ?? kind;
  return pillars.find((pillar) => pillar.id === id)?.label ?? null;
}

const PILLAR_TINTS = ["#7d8b99", "#6e8b84", "#8d7d6a", "#7a7390", "#6d7f72", "#8a7568"];

export function pillarTint(label: string, labels: readonly string[]): string {
  const index = labels.indexOf(label);
  return PILLAR_TINTS[(index < 0 ? 0 : index) % PILLAR_TINTS.length];
}

export function planChannels(
  post: Pick<QueuePost, "templateType" | "metadata" | "status">,
  publications: readonly { platform: string; status: string | null }[],
): PlanChannel[] {
  const facebookOnly = targetChannel(post) === "facebook";
  const stateOf = (platform: PlanChannelId, instagram?: boolean): PlanChannelState => {
    const row = publications.find((item) => item.platform === platform);
    if (row?.status === "posted") return "sent";
    if (row?.status === "failed") return "failed";
    if (instagram && post.status === "posted") return "sent";
    if (instagram && post.status === "failed") return "failed";
    if (facebookOnly && post.status === "posted") return "sent";
    if (facebookOnly && post.status === "failed") return "failed";
    return "planned";
  };
  if (facebookOnly) return [{ id: "facebook", state: stateOf("facebook") }];
  const channels: PlanChannel[] = [
    { id: "instagram", state: stateOf("instagram", true) },
    { id: "facebook", state: stateOf("facebook") },
  ];
  if (post.templateType === "reel" || post.templateType === "carousel")
    channels.push({ id: "tiktok", state: stateOf("tiktok") });
  return channels;
}

export function movePlanTime(
  post: { status: string | null },
  at: number,
  now: number,
): { ok: true; at: number } | { ok: false; reason: string } {
  if (post.status === "posted")
    return { ok: false, reason: "Published posts are read-only" };
  if (post.status !== "pending" && post.status !== "approved")
    return { ok: false, reason: "Only posts in review or approved posts can be given a time" };
  try {
    return { ok: true, at: futureTime(at, now) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not move it",
    };
  }
}

export function bestTimeReason(postedCount: number): string {
  if (postedCount < 20)
    return `Best time stays hidden until 20 posted posts. This project has ${postedCount}.`;
  return "Best time stays hidden until an hourly follower history is stored. None is stored yet.";
}

export function planHealth(input: {
  planned: number;
  openSlots: number;
  needsTime: number;
}): string {
  const slotWord = input.openSlots === 1 ? "slot" : "slots";
  const needWord = input.needsTime === 1 ? "needs" : "need";
  return `${input.planned} planned, ${input.openSlots} open ${slotWord}, ${input.needsTime} ${needWord} a time`;
}

function statusKey(state: Timing, withClaude: boolean): PlanStatusKey {
  if (
    withClaude &&
    (state === "proposed" || state === "proposal-passed" || state === "unplanned")
  )
    return "claude";
  if (state === "posted") return "posted";
  if (state === "failed") return "failed";
  if (state === "scheduled" || state === "due") return "scheduled";
  return "review";
}

export function assemblePlan(
  posts: QueuePost[],
  now: number,
  withClaude: ReadonlySet<string>,
  publications: readonly { postId: string; platform: string; status: string | null }[],
  pillars: readonly { id: string; label: string }[],
  noteCounts: ReadonlyMap<string, number>,
): { placed: PlanCard[]; unplaced: PlanCard[] } {
  const placed: PlanCard[] = [];
  const unplaced: PlanCard[] = [];
  for (const post of posts) {
    const state = timing(post, now);
    if (state === "off") continue;
    const at = state === "posted" ? post.postedAt : post.scheduledAt;
    const clock = at == null ? null : clockMinutes(at);
    const kind = queueKind(post);
    const { format, slides } = planFormat(post);
    const metrics = storedInsights(post.insightsJson).metrics;
    const card: PlanCard = {
      id: post.id,
      at: at ?? null,
      day: clock?.day ?? null,
      minutes: clock?.minutes ?? null,
      time: clock?.time ?? null,
      label: postLabel(post),
      caption: (post.caption ?? "").replace(/\s+/g, " ").trim(),
      word: withClaude.has(post.id) && statusKey(state, true) === "claude"
        ? WORD.claude
        : WORD[state] ?? "",
      statusKey: statusKey(state, withClaude.has(post.id)),
      imagePath: post.imagePath,
      format,
      slides,
      channels: planChannels(
        post,
        publications.filter((row) => row.postId === post.id),
      ),
      pillar: pillarLabel(kind, pillars),
      reach: state === "posted" && typeof metrics.reach === "number" ? metrics.reach : null,
      sends: state === "posted" && typeof metrics.shares === "number" ? metrics.shares : null,
      movable: post.status === "pending" || post.status === "approved",
      notes: noteCounts.get(post.id) ?? 0,
      facebookOnly: targetChannel(post) === "facebook",
    };
    if (state === "unplanned" || state === "no-time" || clock == null) unplaced.push(card);
    else placed.push(card);
  }
  placed.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return { placed, unplaced };
}

export function openSlots(
  days: readonly string[],
  rhythm: readonly WeeklySlot[],
  cards: readonly { day: string | null; minutes: number | null }[],
  now: number,
): PlanSlot[] {
  const filled = new Set(
    cards
      .filter((card) => card.day && card.minutes != null)
      .map((card) => `${card.day}:${Math.floor(card.minutes! / 60)}`),
  );
  const slots: PlanSlot[] = [];
  for (const day of days) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const rule of rhythm) {
      if (!rule.days.includes(weekday)) continue;
      if (filled.has(`${day}:${rule.hour}`)) continue;
      const time = `${String(rule.hour).padStart(2, "0")}:00`;
      const at = localTimestamp(`${day}T${time}`);
      if (!Number.isFinite(at) || at <= now) continue;
      slots.push({ day, hour: rule.hour, time, at, label: rule.label, kind: rule.kind });
    }
  }
  return slots;
}

export function feedTiles(cards: readonly PlanCard[]): PlanCard[] {
  return cards
    .filter(
      (card) =>
        !card.facebookOnly &&
        !!card.imagePath &&
        card.at != null &&
        (card.statusKey === "posted" ||
          card.statusKey === "scheduled" ||
          card.statusKey === "review"),
    )
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, 12);
}

export type PlanFilter = {
  status: string;
  channel: string;
  format: string;
  pillar: string;
  q: string;
};

export const EMPTY_FILTER: PlanFilter = {
  status: "all",
  channel: "all",
  format: "all",
  pillar: "all",
  q: "",
};

export function matchesFilter(card: PlanCard, filter: PlanFilter): boolean {
  if (filter.status !== "all" && card.statusKey !== filter.status) return false;
  if (filter.channel !== "all" && !card.channels.some((channel) => channel.id === filter.channel))
    return false;
  if (filter.format !== "all" && card.format !== filter.format) return false;
  if (filter.pillar === "none" && card.pillar != null) return false;
  if (filter.pillar !== "all" && filter.pillar !== "none" && card.pillar !== filter.pillar)
    return false;
  const query = filter.q.trim().toLowerCase();
  if (!query) return true;
  return `${card.label} ${card.caption} ${card.word}`.toLowerCase().includes(query);
}

export function firstOpenHour(slots: readonly PlanSlot[], day: string): PlanSlot | null {
  return (
    slots.find((slot) => slot.day === day) ??
    null
  );
}

export function planHref(
  projectId: string,
  today: string,
  anchor: string,
  view: PlanView | null,
  post?: string,
): string {
  const query = new URLSearchParams();
  if (anchor !== today) query.set("w", anchor);
  if (view) query.set("v", view);
  if (post) query.set("post", post);
  const text = query.toString();
  return `/projects/${projectId}/plan${text ? `?${text}` : ""}`;
}
