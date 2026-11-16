
export type CopyMode = "claude_session" | "generator";

/**
 * Who may write a project's copy: the built-in generator, or only a Claude session
 * (the generator is then switched off for the project). Set in Setup.
 */
export function copyMode(project: { id: string; copyMode?: string | null }): CopyMode {
  if (project.copyMode === "claude_session" || project.copyMode === "generator")
    return project.copyMode;
  return "generator";
}

/** Store a site as a host plus an optional path, with no scheme. Blank clears it. */
export function normalizeBioLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const bare = text.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (bare.length > 200 || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s]*)?$/i.test(bare))
    throw new Error("Use a site address, like example.com");
  return bare;
}

/**
 * The address a caption's "link in bio" becomes on TikTok and Facebook.
 * A project keeps the words "link in bio" until its own site is set.
 */
export function bioLinkFor(
  project: { id: string; bioLink?: string | null } | null | undefined,
): string | null {
  const set = project?.bioLink?.trim();
  if (set) return set;
  return null;
}
