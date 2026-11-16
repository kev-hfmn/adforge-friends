import { metadata, slidesFor, targetChannel, queueKind, type QueuePost } from "./queue-view";
import {
  blocksOf,
  checkStudioCopy,
  parseAltTexts,
  studioFormat,
  type StudioChannel,
  type StudioIssue,
  type ChannelDraft,
} from "./studio-check";

export type CopyDraft = {
  firstComment?: string;
  altTexts?: string[];
  variants?: Partial<Record<StudioChannel, ChannelDraft>>;
};
import { studioSources } from "./studio-sources";
import { variantsFor } from "./studio-store";

/**
 * Checked facts a post's copy is gated against: every number in the caption must
 * appear in them. A fact-check post must have them; a film may.
 */
export function queueCopyContext(post: QueuePost): { allowed: string } | null {
  const kind = queueKind(post),
    meta = metadata(post);
  const facts = typeof meta.facts === "string" ? meta.facts.trim() : "";
  if (kind === "correction" && !facts)
    throw new Error("Missing checked facts. Restore provenance before saving.");
  return facts ? { allowed: facts } : null;
}

function imageCount(post: QueuePost): number {
  if (post.templateType === "carousel") {
    const count = slidesFor(post).length;
    return count > 0 ? count : 1;
  }
  return 1;
}

function altTextsFor(post: QueuePost, stored: string | null | undefined): string[] {
  const parsed = parseAltTexts(stored);
  const count = imageCount(post);
  if (parsed) return Array.from({ length: count }, (_, index) => parsed[index] ?? "");
  const shared = metadata(post).altText?.trim() ?? "";
  if (!shared) return Array.from({ length: count }, () => "");
  return Array.from({ length: count }, () => shared);
}

export async function reviewQueueCopy(
  post: QueuePost,
  caption: string,
  hashtags: string,
  draft?: CopyDraft,
): Promise<StudioIssue[]> {
  let context: { allowed: string } | null = null;
  let provenance: string | null = null;
  try {
    context = queueCopyContext(post);
  } catch (error) {
    provenance = error instanceof Error ? error.message : "Copy check failed";
  }
  const sources = post.projectId ? studioSources(post.projectId) : null;
  const rows = await variantsFor(post.id);
  const variants: Partial<Record<StudioChannel, ChannelDraft>> = {};
  let firstComment = "";
  let altStored: string | null | undefined;
  for (const row of rows) {
    if (row.channel === "instagram" || row.channel === "facebook" || row.channel === "tiktok" || row.channel === "x") {
      variants[row.channel] = {
        caption: row.caption,
        hashtags: row.hashtags,
        firstComment: row.firstComment,
      };
    }
    if (row.channel === "instagram") {
      firstComment = row.firstComment ?? "";
      altStored = row.altText;
    }
  }
  if (draft?.variants) Object.assign(variants, draft.variants);
  if (draft?.firstComment !== undefined) firstComment = draft.firstComment;
  const meta = metadata(post);
  const allowedText = [context?.allowed, typeof meta.facts === "string" ? meta.facts : ""]
    .filter(Boolean)
    .join("\n");
  const issues = checkStudioCopy({
    caption,
    hashtags,
    firstComment,
    variants,
    allowedNumbers: sources?.numbers.map((item) => item.value) ?? [],
    allowedText,
    banned: sources?.banned ?? [],
    voiceRules: sources?.voiceRules ?? [],
    format: studioFormat(post.templateType),
    altTexts: draft?.altTexts ?? altTextsFor(post, altStored),
    storedHashtags: post.hashtags,
    primary: targetChannel(post) === "facebook" ? "facebook" : "instagram",
    altRequired: Boolean(draft?.altTexts) || rows.some((row) => row.channel === "instagram"),
  });
  if (provenance) issues.unshift({ level: "block", code: "provenance", message: provenance });
  return issues;
}

/** Block messages only. Warnings stay in reviewQueueCopy and do not stop a save or an approval. */
export async function checkQueueCopy(
  post: QueuePost,
  caption: string,
  hashtags: string,
  draft?: CopyDraft,
): Promise<string[]> {
  const issues = await reviewQueueCopy(post, caption, hashtags, draft);
  return blocksOf(issues).map((issue) => issue.message);
}
