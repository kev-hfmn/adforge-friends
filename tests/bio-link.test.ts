import { describe, expect, it } from "vitest";
import { channelText } from "@/lib/crosspost-rules";
import { bioLinkFor, normalizeBioLink } from "@/lib/project-rules";

describe("a project's own site", () => {
  it("sends a project to its own site", () => {
    expect(normalizeBioLink("https://example.com/")).toBe("example.com");
    const link = bioLinkFor({ id: "other", bioLink: "example.com/app" });
    expect(channelText("Open the app. Link in bio.", "tiktok", link)).toBe(
      "Open the app. example.com/app",
    );
    expect(channelText("Open the app. Link in bio.", "facebook", link)).toBe(
      "Open the app. https://example.com/app?utm_source=facebook&utm_medium=social&utm_campaign=crosspost",
    );
  });

  it("leaves the words alone when a project has no site yet", () => {
    expect(bioLinkFor({ id: "other", bioLink: null })).toBeNull();
    expect(channelText("Link in bio.", "tiktok", null)).toBe("Link in bio.");
  });

  it("rejects an address that is not a site", () => {
    expect(() => normalizeBioLink("not a site")).toThrow(/site address/);
  });
});
