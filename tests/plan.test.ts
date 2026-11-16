import { describe, expect, it } from "vitest";
import {
  assemblePlan,
  clockMinutes,
  feedTiles,
  mondayOf,
  movePlanTime,
  openSlots,
  periodOf,
  planChannels,
  planHealth,
  snapDrop,
  visibleHours,
} from "@/lib/plan";
import { localInput, localTimestamp, WEEKLY_SLOTS } from "@/lib/queue-schedule";
import type { QueuePost } from "@/lib/queue-view";

function post(partial: Partial<QueuePost> & Pick<QueuePost, "id">): QueuePost {
  return {
    status: "pending",
    scheduledAt: null,
    postedAt: null,
    templateType: "ad",
    layoutStyle: null,
    metadata: null,
    carouselSlides: null,
    imagePath: "/img.png",
    headline: partial.id,
    caption: "",
    insightsJson: null,
    projectId: "p",
    ...partial,
  } as QueuePost;
}

describe("a week across daylight saving (Lisbon)", () => {
  it("keeps 18:00 on both sides of the spring change", () => {
    const saturday = localTimestamp("2026-03-28T18:00");
    const sunday = localTimestamp("2026-03-29T18:00");
    expect(localInput(saturday)).toBe("2026-03-28T18:00");
    expect(localInput(sunday)).toBe("2026-03-29T18:00");
    expect(sunday - saturday).toBe(23 * 3600 * 1000);
    expect(mondayOf("2026-03-29")).toBe("2026-03-23");
    expect(periodOf("week", "2026-03-29").grid).toEqual([
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
    ]);
  });

  it("keeps 18:00 on both sides of the autumn change", () => {
    const saturday = localTimestamp("2026-10-24T18:00");
    const sunday = localTimestamp("2026-10-25T18:00");
    expect(localInput(saturday)).toBe("2026-10-24T18:00");
    expect(localInput(sunday)).toBe("2026-10-25T18:00");
    expect(sunday - saturday).toBe(25 * 3600 * 1000);
  });
});

describe("moving a post", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");

  it("refuses a posted post and a time that has passed", () => {
    expect(movePlanTime({ status: "posted" }, now + 60_000, now)).toEqual({
      ok: false,
      reason: "Published posts are read-only",
    });
    expect(movePlanTime({ status: "approved" }, now - 60_000, now).ok).toBe(false);
    expect(movePlanTime({ status: "draft" }, now + 60_000, now).ok).toBe(false);
  });

  it("accepts a future time for a post in review", () => {
    const at = now + 3_600_000;
    expect(movePlanTime({ status: "pending" }, at, now)).toEqual({ ok: true, at });
  });

  it("snaps a drop to 15 minutes", () => {
    expect(snapDrop(18, 0, 80)).toBe("18:00");
    expect(snapDrop(18, 20, 80)).toBe("18:15");
    expect(snapDrop(18, 40, 80)).toBe("18:30");
    expect(snapDrop(18, 79, 80)).toBe("18:45");
  });
});

describe("slots and hours", () => {
  it("hides a rhythm slot once that hour has a post", () => {
    const now = localTimestamp("2026-11-16T08:00") - 60_000;
    const monday = "2026-11-16";
    const cards = [{ day: monday, minutes: 18 * 60 + 22 }];
    const rhythm = [
      { days: [1], hour: 8, kind: "other" as const, label: "Morning post" },
      ...WEEKLY_SLOTS,
    ];
    const slots = openSlots([monday], rhythm, cards, now);
    expect(slots.some((slot) => slot.hour === 18)).toBe(false);
    expect(slots.some((slot) => slot.label === "Morning post")).toBe(true);
  });

  it("shows only the hours that have a post or a slot", () => {
    expect(visibleHours([8 * 60 + 19, 18 * 60], [12])).toEqual([8, 12, 18]);
    expect(visibleHours([6 * 60], [])).toEqual([6]);
  });
});

describe("channels and the profile grid", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");

  it("sends a reel to Instagram, Facebook and TikTok, and a photo skips TikTok", () => {
    expect(
      planChannels({ templateType: "reel", metadata: null, status: "approved" }, []).map(
        (channel) => channel.id,
      ),
    ).toEqual(["instagram", "facebook", "tiktok"]);
    expect(
      planChannels({ templateType: "ad", metadata: null, status: "pending" }, []).map(
        (channel) => channel.id,
      ),
    ).toEqual(["instagram", "facebook"]);
  });

  it("keeps a Facebook-only post off the profile grid and puts a later post first", () => {
    const { placed } = assemblePlan(
      [
        post({
          id: "fb",
          status: "approved",
          scheduledAt: now + 86_400_000,
          metadata: JSON.stringify({ channel: "facebook" }),
          headline: "Page only",
        }),
        post({
          id: "old",
          status: "posted",
          postedAt: now - 86_400_000,
          headline: "Already out",
        }),
        post({
          id: "next",
          status: "approved",
          scheduledAt: now + 3_600_000,
          templateType: "reel",
          headline: "Coming up",
        }),
      ],
      now,
      new Set(),
      [{ postId: "next", platform: "tiktok", status: "failed" }],
      [],
      new Map(),
    );
    expect(feedTiles(placed).map((card) => card.id)).toEqual(["next", "old"]);
    expect(placed.find((card) => card.id === "next")?.channels.find((c) => c.id === "tiktok")?.state).toBe(
      "failed",
    );
    expect(placed.find((card) => card.id === "fb")?.channels).toEqual([
      { id: "facebook", state: "planned" },
    ]);
  });
});

describe("health line", () => {
  it("counts planned posts, open slots and posts that need a time", () => {
    expect(planHealth({ planned: 5, openSlots: 1, needsTime: 2 })).toBe(
      "5 planned, 1 open slot, 2 need a time",
    );
  });
});

describe("clock placement", () => {
  it("places a post on the Lisbon day of its timestamp", () => {
    const at = localTimestamp("2026-03-29T18:00");
    expect(clockMinutes(at)).toEqual({
      day: "2026-03-29",
      time: "18:00",
      minutes: 18 * 60,
    });
  });
});
