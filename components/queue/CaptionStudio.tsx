"use client";

import { useState, type RefObject } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CHANNEL_LIMITS,
  channelBody,
  channelName,
  hashtagCount,
  replaceDashes,
  type StudioChannel,
  type StudioIssue,
} from "@/lib/studio-check";
import type { GroundingItem, NumberSource } from "@/lib/studio-sources";
import type { SnippetRow } from "@/lib/studio-store";
import type { CopyMode } from "@/lib/project-rules";

const EXTRA: StudioChannel[] = ["facebook", "tiktok", "x"];

function hasNumber(text: string, token: string): boolean {
  return new RegExp(`(^|[^\\d.])${token.replace(".", "\\.")}([^\\d]|$)`).test(text);
}

export type VariantState = Partial<Record<StudioChannel, { caption: string | null; hashtags: string | null; firstComment: string }>>;

export function CopyChecks({
  issues,
  overrides,
  onOverride,
}: {
  issues: StudioIssue[];
  overrides: string[];
  onOverride: (code: string) => void;
}) {
  const hidden = new Set(overrides);
  const visible = issues.filter((issue) => issue.level === "block" || !hidden.has(issue.code));
  const blocks = visible.filter((issue) => issue.level === "block");
  const warnings = visible.filter((issue) => issue.level === "warn");
  const label = blocks.length
    ? `Blocked: ${blocks.length} ${blocks.length === 1 ? "issue" : "issues"}`
    : warnings.length
      ? "Ready with warnings"
      : "Ready";
  const tone = blocks.length ? "text-destructive" : warnings.length ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300";
  return (
    <div className="space-y-3" aria-live="polite">
      <p className={`text-sm font-medium ${tone}`}>{label}</p>
      {blocks.length === 0 && warnings.length === 0 ? (
        <p className="text-xs text-muted-foreground">Numbers, banned lines, and length are clear.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((issue) => (
            <li key={`${issue.channel ?? ""}:${issue.code}`} className="text-xs leading-5">
              <span className={issue.level === "block" ? "text-destructive" : "text-amber-800 dark:text-amber-200"}>
                {issue.message}
              </span>
              {issue.level === "warn" ? (
                <button
                  type="button"
                  className="ml-2 inline-flex min-h-10 items-center underline"
                  onClick={() => onOverride(issue.code)}
                >
                  Override
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CaptionStudio({
  caption,
  hashtags,
  onCaption,
  onHashtags,
  firstComment,
  onFirstComment,
  altTexts,
  onAltTexts,
  variants,
  onVariants,
  location,
  onLocation,
  issues,
  overrides,
  onOverride,
  numbers,
  related,
  snippets,
  onCreateSnippet,
  storyItems,
  storyGate,
  onStoryGate,
  copyMode,
  onAsk,
  blocked,
  captionRef,
}: {
  caption: string;
  hashtags: string;
  onCaption: (value: string) => void;
  onHashtags: (value: string) => void;
  firstComment: string;
  onFirstComment: (value: string) => void;
  altTexts: string[];
  onAltTexts: (value: string[]) => void;
  variants: VariantState;
  onVariants: (value: VariantState) => void;
  location: string;
  onLocation: (value: string) => void;
  issues: StudioIssue[];
  overrides: string[];
  onOverride: (code: string) => void;
  numbers: NumberSource[];
  related: GroundingItem[];
  snippets: SnippetRow[];
  onCreateSnippet: (label: string, body: string) => void;
  storyItems: string[];
  storyGate: string[];
  onStoryGate: (value: string[]) => void;
  copyMode: CopyMode;
  onAsk: (instruction: string) => void;
  blocked: boolean;
  captionRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [dashNote, setDashNote] = useState("");
  const [slash, setSlash] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [snippetLabel, setSnippetLabel] = useState("");
  const tags = hashtagCount(`${caption}\n${hashtags}`);
  const count = Array.from(channelBody(caption, hashtags)).length;
  const seen = new Set<string>();
  const grounded = numbers.filter((item) => {
    if (!hasNumber(caption, item.value) && !hasNumber(hashtags, item.value)) return false;
    if (seen.has(item.entryId)) return false;
    seen.add(item.entryId);
    return true;
  });

  function noteDashes(count: number) {
    if (count) setDashNote(count === 1 ? "Replaced 1 dash" : `Replaced ${count} dashes`);
  }
  function editCaption(value: string, element: HTMLTextAreaElement) {
    const next = replaceDashes(value);
    onCaption(next.text);
    noteDashes(next.count);
    const pos = element.selectionStart ?? next.text.length;
    const match = /(?:^|\s)\/([\w-]*)$/.exec(next.text.slice(0, pos));
    setSlash(match ? match[1] : null);
    setCursor(pos);
  }
  function editPlain(value: string, apply: (next: string) => void) {
    const next = replaceDashes(value);
    apply(next.text);
    noteDashes(next.count);
  }
  function insertSnippet(body: string) {
    const before = caption.slice(0, cursor);
    const after = caption.slice(cursor);
    const replaced = before.replace(/(?:^|\s)\/[\w-]*$/, (match) => (match.startsWith(" ") || match.startsWith("\n") ? match[0] : "") + body);
    onCaption(replaced + after);
    setSlash(null);
  }
  function setVariant(channel: StudioChannel, patch: Partial<{ caption: string | null; hashtags: string | null; firstComment: string }>) {
    const current = variants[channel] ?? { caption: null, hashtags: null, firstComment: "" };
    onVariants({ ...variants, [channel]: { ...current, ...patch } });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="queue-caption">Caption</Label>
          <span className={`text-xs tabular-nums ${count > CHANNEL_LIMITS.instagram ? "text-destructive" : "text-muted-foreground"}`}>
            {count.toLocaleString()} / {CHANNEL_LIMITS.instagram.toLocaleString()}
          </span>
        </div>
        <Textarea
          id="queue-caption"
          ref={captionRef}
          value={caption}
          onChange={(event) => editCaption(event.target.value, event.target)}
          onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
          disabled={blocked}
          className="min-h-40"
          aria-invalid={issues.some((issue) => issue.level === "block")}
        />
        {slash !== null ? (
          <ul className="rounded-lg border border-border p-1" aria-label="Saved lines">
            {snippets.filter((item) => item.label.toLowerCase().includes(slash.toLowerCase())).slice(0, 6).map((item) => (
              <li key={item.id}>
                <button type="button" className="min-h-10 w-full rounded px-2 text-left text-sm hover:bg-muted" onClick={() => insertSnippet(item.body)}>
                  {item.label}
                </button>
              </li>
            ))}
            {snippets.length === 0 ? <li className="px-2 py-2 text-xs text-muted-foreground">No saved lines yet.</li> : null}
          </ul>
        ) : null}
        {dashNote ? <p className="text-xs text-muted-foreground">{dashNote}</p> : null}
        <p className="text-xs text-muted-foreground">Type / to insert a saved line. Dashes are replaced as you type.</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="queue-hashtags">Hashtags</Label>
          <span className={`text-xs tabular-nums ${tags > 5 ? "text-destructive" : "text-muted-foreground"}`}>{tags} / 5</span>
        </div>
        <Textarea
          id="queue-hashtags"
          value={hashtags}
          onChange={(event) => editPlain(event.target.value, onHashtags)}
          disabled={blocked}
          rows={2}
          className="field-sizing-fixed"
        />
      </div>

      {EXTRA.map((channel) => {
        const variant = variants[channel] ?? { caption: null, hashtags: null, firstComment: "" };
        const own = variant.caption != null || variant.hashtags != null;
        const body = channelBody(variant.caption ?? caption, variant.hashtags ?? hashtags);
        const length = Array.from(body).length;
        return (
          <div key={channel} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {channelName(channel)}
                {own ? <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">Differs</span> : null}
              </p>
              <span className={`text-xs tabular-nums ${length > CHANNEL_LIMITS[channel] ? "text-destructive" : "text-muted-foreground"}`}>
                {length.toLocaleString()} / {CHANNEL_LIMITS[channel].toLocaleString()}
              </span>
            </div>
            {variant.caption == null ? (
              <button
                type="button"
                className="min-h-10 text-left text-sm text-muted-foreground underline"
                disabled={blocked}
                onClick={() => setVariant(channel, { caption })}
              >
                Same as the main caption. {channel === "x" ? "Write an X version." : `Write a ${channelName(channel)} version.`}
              </button>
            ) : (
              <>
                <Textarea
                  value={variant.caption}
                  aria-label={`${channelName(channel)} caption`}
                  disabled={blocked}
                  className="min-h-24"
                  onChange={(event) => editPlain(event.target.value, (next) => setVariant(channel, { caption: next }))}
                />
                <button type="button" className="min-h-10 text-xs underline" disabled={blocked} onClick={() => setVariant(channel, { caption: null, hashtags: null })}>
                  Use the main caption
                </button>
              </>
            )}
          </div>
        );
      })}

      <div className="space-y-2">
        <Label htmlFor="queue-first-comment">First comment</Label>
        <Textarea
          id="queue-first-comment"
          value={firstComment}
          onChange={(event) => editPlain(event.target.value, onFirstComment)}
          disabled={blocked}
          rows={2}
          className="field-sizing-fixed"
        />
      </div>

      <div className="space-y-2">
        {altTexts.map((alt, index) => (
          <div key={index} className="space-y-1">
            <Label htmlFor={`queue-alt-${index}`}>{altTexts.length > 1 ? `Alt text, slide ${index + 1}` : "Alt text"}</Label>
            <Textarea
              id={`queue-alt-${index}`}
              value={alt}
              onChange={(event) => {
                const next = altTexts.slice();
                next[index] = event.target.value;
                onAltTexts(next);
              }}
              disabled={blocked}
              rows={2}
              className="field-sizing-fixed"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="queue-location">Location</Label>
        <Input id="queue-location" value={location} onChange={(event) => onLocation(event.target.value)} disabled={blocked} />
      </div>

      {storyItems.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Story gate</legend>
          <p className="text-xs text-muted-foreground">Ticking these is a record. It does not block approval.</p>
          {storyItems.map((item) => (
            <label key={item} className="flex min-h-10 items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={storyGate.includes(item)}
                disabled={blocked}
                onChange={(event) =>
                  onStoryGate(event.target.checked ? [...storyGate, item] : storyGate.filter((line) => line !== item))
                }
              />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">From the hub</h3>
        {grounded.length === 0 && related.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matching facts yet. Add facts in the hub and a number in the caption can use them.</p>
        ) : (
          <ul className="space-y-2">
            {grounded.map((item) => (
              <li key={item.entryId}>
                <button
                  type="button"
                  className="min-h-10 text-left text-sm underline-offset-2 hover:underline"
                  disabled={blocked}
                  onClick={() => onCaption(caption ? `${caption.trim()} ${item.insert}` : item.insert)}
                >
                  {item.value}: {item.title}
                </button>
              </li>
            ))}
            {related.filter((item) => !grounded.some((fact) => fact.entryId === item.id)).map((item) => (
              <li key={item.id} className="text-xs text-muted-foreground">
                {item.type}: {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!snippetLabel.trim()) return;
          onCreateSnippet(snippetLabel.trim(), caption.trim() || firstComment.trim());
          setSnippetLabel("");
        }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="snippet-label">Save the caption as a line</Label>
          <Input id="snippet-label" value={snippetLabel} onChange={(event) => setSnippetLabel(event.target.value)} disabled={blocked} />
        </div>
        <button type="submit" className="min-h-10 rounded-lg border border-border px-3 text-sm" disabled={blocked || !snippetLabel.trim()}>
          Save line
        </button>
      </form>

      <button type="button" className="min-h-11 w-full rounded-lg border border-border px-3 text-sm" disabled={blocked} onClick={() => onAsk("Make it shorter and clearer. Keep every fact.")}>
        {copyMode === "claude_session" ? "Ask Claude to rewrite" : "Suggest a rewrite"}
      </button>
      <p className="text-xs text-muted-foreground">
        {copyMode === "claude_session"
          ? "This writes a note and moves the post to With Claude. The caption stays as it is."
          : "A suggestion appears under the notes. Accept it to replace the caption, or dismiss it."}
      </p>

      <div className="@5xl:hidden">
        <CopyChecks issues={issues} overrides={overrides} onOverride={onOverride} />
      </div>
    </div>
  );
}
