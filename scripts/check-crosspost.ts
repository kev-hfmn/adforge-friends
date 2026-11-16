// Checks the cross-posting rules: npx tsx scripts/check-crosspost.ts
import assert from "node:assert/strict";
import {
  FACEBOOK_IMAGE_LIMIT,
  channelText,
  duePublications,
  postMedia,
  tiktokRequest,
  publicationOutcome,
  skipReason,
} from "../lib/crosspost-rules";

function main() {
  const base = "https://adforge.example.com";
  const linkedAt = 1_000;
  const tiktok = { platform: "tiktok", provider: "zernio", accountId: "tt1", createdAt: linkedAt };
  const facebook = { platform: "facebook", provider: "meta", accountId: "page1", createdAt: linkedAt };
  const reel = { id: "r", status: "posted", postedAt: 2_000, templateType: "reel" };
  const card = { id: "c", status: "posted", postedAt: 2_000, templateType: "ad" };
  const old = { id: "o", status: "posted", postedAt: 500, templateType: "reel" };
  const queued = { id: "q", status: "approved", postedAt: null, templateType: "reel" };

  // TikTok: motion only. Facebook: everything.
  assert.equal(skipReason(card, "tiktok"), "TikTok gets reels and carousels only");
  assert.equal(skipReason(card, "facebook"), null);
  assert.equal(skipReason({ templateType: "carousel" }, "tiktok"), null);

  // Facebook only: never cross-posted anywhere (it is sent to the Page directly).
  const fbOnly = { id: "f", status: "posted", postedAt: 2_000, templateType: "carousel", metadata: '{"channel":"facebook"}' };
  assert.equal(skipReason(fbOnly, "tiktok"), "Facebook-only post");
  assert.ok(skipReason(fbOnly, "facebook"));
  assert.deepEqual(duePublications([fbOnly], [tiktok, facebook], []), []);
  assert.equal(skipReason({ templateType: "carousel", metadata: '{"postType":"x"}' }, "tiktok"), null);

  const due = duePublications([reel, card, old, queued], [tiktok, facebook], []);
  assert.deepEqual(due, [
    { postId: "r", platform: "tiktok" },
    { postId: "r", platform: "facebook" },
    { postId: "c", platform: "facebook" },
  ]);
  // Already sent (or failed) means never sent twice by the scheduler.
  assert.deepEqual(
    duePublications([reel], [tiktok], [{ postId: "r", platform: "tiktok" }]),
    [],
  );
  // A direct Instagram channel or a half-linked row sends nothing.
  assert.deepEqual(
    duePublications([reel], [{ ...tiktok, provider: null }, { ...facebook, accountId: null }], []),
    [],
  );

  const reelPost = {
    templateType: "reel",
    caption: "Fresh bread, every morning.",
    hashtags: "#bakery",
    imagePath: "/generated/cover.png",
    videoPath: "/generated/r.mp4",
    carouselSlides: null,
  };
  const tt = tiktokRequest(reelPost, "tt1", base);
  assert.equal(tt.content, "Fresh bread, every morning.\n\n#bakery");
  assert.deepEqual(tt.mediaItems, [{ type: "video", url: `${base}/generated/r.mp4` }]);
  assert.equal(tt.publishNow, true);
  assert.equal(tt.tiktokSettings?.privacy_level, "PUBLIC_TO_EVERYONE");
  assert.equal(tt.tiktokSettings?.express_consent_given, true);
  assert.deepEqual(tt.platforms, [
    {
      platform: "tiktok",
      accountId: "tt1",
      platformSpecificData: { videoCoverImageUrl: `${base}/generated/cover.png` },
    },
  ]);
  const fb = postMedia(reelPost, base, FACEBOOK_IMAGE_LIMIT);
  assert.deepEqual(fb.media, { kind: "video", url: `${base}/generated/r.mp4` });
  assert.equal(fb.text, "Fresh bread, every morning.\n\n#bakery");

  const slides = (n: number) =>
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({ imagePath: `/generated/s${i}.png` })),
    );
  const carousel = { ...reelPost, templateType: "carousel", videoPath: null, carouselSlides: slides(3) };
  assert.deepEqual(
    tiktokRequest(carousel, "tt1", base).mediaItems.map((m: { url: string }) => m.url),
    [0, 1, 2].map((i) => `${base}/generated/s${i}.png`),
  );
  assert.throws(
    () => postMedia({ ...carousel, carouselSlides: slides(11) }, base, FACEBOOK_IMAGE_LIMIT),
    /At most 10/,
  );
  assert.throws(
    () => tiktokRequest({ ...reelPost, videoPath: null }, "tt1", base),
    /no video/,
  );

  assert.deepEqual(
    publicationOutcome(
      { _id: "z", status: "published", platforms: [{ platform: "tiktok", status: "published", platformPostUrl: "https://tiktok.com/x" }] },
      "tiktok",
    ),
    { status: "posted", url: "https://tiktok.com/x", error: null },
  );
  assert.equal(
    publicationOutcome(
      { _id: "z", status: "failed", platforms: [{ platform: "facebook", status: "failed", errorMessage: "Token expired" }] },
      "facebook",
    ).error,
    "Token expired",
  );
  assert.equal(publicationOutcome({ _id: "z", status: "publishing" }, "tiktok").status, "publishing");
  // "Link in bio" only makes sense on Instagram: other channels get the project's site.
  const site = "example.com";
  const ending = "Order online. Link in bio.";
  assert.equal(channelText(ending, "tiktok", site), "Order online. example.com");
  assert.equal(
    channelText(ending, "facebook", site),
    "Order online. https://example.com/?utm_source=facebook&utm_medium=social&utm_campaign=crosspost",
  );
  assert.equal(channelText(ending, "tiktok"), ending, "no site set: the words stay");
  assert.match(
    tiktokRequest({ ...reelPost, caption: ending }, "tt1", base, null, site).content,
    /example\.com\n\n#bakery$/,
  );
  console.log("check-crosspost: all good");
}
main();
