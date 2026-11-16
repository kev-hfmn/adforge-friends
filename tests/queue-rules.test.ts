import { describe, expect, it } from "vitest";
import { approvalTime, futureTime } from "@/lib/queue-rules";
import { localInput, localTimestamp } from "@/lib/queue-schedule";

const post = { status: "pending", scheduledAt: null as number | null };

describe("approval time", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");

  it("refuses a missing time", () => {
    expect(() => approvalTime(post, undefined, now)).toThrow(/time/i);
  });

  it("refuses a time that has passed", () => {
    expect(() => approvalTime({ ...post, scheduledAt: now - 60_000 }, undefined, now)).toThrow(/passed/i);
    expect(() => futureTime(now, now)).toThrow(/future/i);
  });

  it("keeps a proposed time that is still ahead", () => {
    const at = now + 3_600_000;
    expect(approvalTime({ ...post, scheduledAt: at }, undefined, now)).toBe(at);
  });
});

describe("Lisbon daylight saving", () => {
  it("round trips noon on both sides of the 2026 changes", () => {
    for (const input of [
      "2026-03-28T18:00",
      "2026-03-30T18:00",
      "2026-10-24T18:00",
      "2026-10-26T18:00",
    ]) {
      expect(localInput(localTimestamp(input))).toBe(input);
    }
  });
});
