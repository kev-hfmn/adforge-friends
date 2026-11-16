import { describe, expect, it } from "vitest";
import { blocksOf, checkStudioCopy, resolvedFields } from "@/lib/studio-check";
import { resolvedCaption } from "@/lib/crosspost-rules";

const base = {
  caption: "",
  hashtags: "",
  allowedNumbers: ["40", "2.5"],
  format: "reel" as const,
  altTexts: ["A tray of fresh bread."],
  altRequired: true,
};

describe("caption studio checks", () => {
  it("accepts a number that is in the hub", () => {
    const issues = checkStudioCopy({
      ...base,
      caption: "Each loaf rests for 2.5 hours.",
    });
    expect(blocksOf(issues)).toEqual([]);
  });

  it("blocks an invented number, which is what approveAt refuses", () => {
    const issues = checkStudioCopy({
      ...base,
      caption: "We bake 12 kinds of bread.",
    });
    const blocks = blocksOf(issues);
    expect(blocks.map((issue) => issue.message)).toEqual(["No source in the hub for 12."]);
    expect(blocks.every((issue) => issue.level === "block")).toBe(true);
  });

  it("grounds numbers in the project's facts and blocks banned phrases", () => {
    const issues = checkStudioCopy({
      ...base,
      allowedNumbers: ["40"],
      caption: "The batch is 40 litres. Do you feel it?",
      banned: [{ pattern: "synergy", reason: "jargon", replacement: "a plain word" }],
    });
    expect(blocksOf(issues)).toEqual([]);

    const banned = checkStudioCopy({
      ...base,
      allowedNumbers: ["40"],
      caption: "The batch is 40 litres of synergy.",
      banned: [{ pattern: "synergy", reason: "jargon", replacement: "a plain word" }],
    });
    expect(blocksOf(banned).map((issue) => issue.message).join(" ")).toMatch(/synergy/);
  });

  it("keeps an old post with more than 5 hashtags as a warning until the tags change", () => {
    const stored = "#a #b #c #d #e #f";
    const kept = checkStudioCopy({ ...base, hashtags: stored, storedHashtags: stored });
    expect(kept.find((issue) => issue.code === "hashtags:legacy")?.level).toBe("warn");
    expect(blocksOf(kept)).toEqual([]);

    const edited = checkStudioCopy({ ...base, hashtags: "#a #b #c #d #e #g", storedHashtags: stored });
    expect(blocksOf(edited).some((issue) => issue.code === "hashtags")).toBe(true);
  });

  it("blocks a dash and a photo with no alt, and only warns on a reel", () => {
    const dash = checkStudioCopy({ ...base, caption: "Quiet \u2014 then the chart." });
    expect(blocksOf(dash).some((issue) => issue.code === "dash")).toBe(true);

    const photo = checkStudioCopy({ ...base, format: "photo", altTexts: [""], caption: "The chart." });
    expect(blocksOf(photo).some((issue) => issue.code === "alt")).toBe(true);

    const oldPhoto = checkStudioCopy({
      ...base,
      format: "photo",
      altTexts: [""],
      caption: "The chart.",
      altRequired: false,
    });
    expect(oldPhoto.find((issue) => issue.code === "alt")?.level).toBe("warn");
    expect(blocksOf(oldPhoto)).toEqual([]);

    const reel = checkStudioCopy({ ...base, format: "reel", altTexts: [""], caption: "The chart." });
    expect(reel.find((issue) => issue.code === "alt")?.level).toBe("warn");
  });

  it("sends a channel variant instead of the main caption", () => {
    const post = { caption: "Main line", hashtags: "#one" };
    expect(resolvedCaption(post, null)).toEqual(post);
    expect(resolvedCaption(post, { caption: "Facebook line", hashtags: null })).toEqual({
      caption: "Facebook line",
      hashtags: "#one",
    });
    const fields = resolvedFields(post, { caption: "TikTok line", hashtags: "#two" });
    expect(fields).toEqual({ caption: "TikTok line", hashtags: "#two" });
  });
});
