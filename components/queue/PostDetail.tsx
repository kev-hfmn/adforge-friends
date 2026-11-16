"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  MoreHorizontal,
  ChevronDown,
  CalendarClock,
  TriangleAlert,
  MessageSquareText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChannelPreview } from "./ChannelPreview";
import { CaptionStudio, CopyChecks, type VariantState } from "./CaptionStudio";
import { ActivityList } from "@/components/activity/ActivityList";
import { StatusChip } from "@/components/studio/StatusChip";
import {
  metadata,
  postLabel,
  queueKind,
  KIND_LABELS,
  slidesFor,
  targetChannel,
  type QueuePost,
} from "@/lib/queue-view";
import {
  formatDayTime,
  formatTime,
  localInput,
  localTimestamp,
  QUEUE_ZONE_LABEL,
} from "@/lib/queue-schedule";
import { timing } from "@/lib/queue-rules";
import { headlineNumbers, storedInsights } from "@/lib/queue-insights";
import type { PostNote } from "@/lib/queue-actions";
import type { PublicationView } from "@/lib/crosspost";
import { checkStudioCopy, parseAltTexts, type StudioChannel } from "@/lib/studio-check";
import type { StudioSources } from "@/lib/studio-sources";
import type { SnippetRow, VariantRow } from "@/lib/studio-store";
import type { CopyMode } from "@/lib/project-rules";
import { parseSuggestion } from "@/lib/studio-suggestion";
import {
  approvePost,
  declinePost,
  deletePost,
  dismissNote,
  requestPostChanges,
  moveToQueue,
  publishToInstagram,
  rerenderPost,
  retryCrosspost,
  retryPublish,
  acceptCaptionSuggestion,
  askForRewrite,
  createSnippet,
  saveQueuePost,
  schedulePost,
  undoDecision,
} from "@/app/projects/[id]/queue/actions";

export type CopyContext = {
  allowed: string;
} | null;
export function PostDetail({
  post: initialPost,
  username,
  connected,
  gridPosts,
  viewIds,
  listLabel,
  notes: initialNotes,
  publications,
  nextSlot,
  copyContext,
  copyError,
  brandColor,
  referenceNow,
  kbLinks = [],
  variantRows,
  hub,
  snippets,
  mode,
  activity = [],
}: {
  post: QueuePost;
  username: string;
  connected: boolean;
  gridPosts: QueuePost[];
  viewIds: string[];
  /** What the list being stepped through is, for "2 of 4 in <label>". */
  listLabel: string;
  notes: PostNote[];
  /** TikTok and Facebook copies of this post, sent after Instagram. */
  publications: PublicationView[];
  nextSlot: number;
  copyContext: CopyContext;
  copyError: string | null;
  brandColor: string;
  referenceNow: number;
  kbLinks?: { id: string; title: string; type: string }[];
  variantRows: VariantRow[];
  hub: StudioSources;
  snippets: SnippetRow[];
  mode: CopyMode;
  activity?: { id: string; text: string }[];
}) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  const [post, setPost] = useState(initialPost),
    [caption, setCaption] = useState(initialPost.caption ?? ""),
    [hashtags, setHashtags] = useState(initialPost.hashtags ?? "");
  const opening = metadata(initialPost);
  const openingInstagram = variantRows.find((row) => row.channel === "instagram");
  const [firstComment, setFirstComment] = useState(openingInstagram?.firstComment ?? "");
  const [altTexts, setAltTexts] = useState(() => seedAlts(initialPost, openingInstagram?.altText));
  const [channelCopy, setChannelCopy] = useState<VariantState>(() => seedVariants(variantRows));
  const [location, setLocation] = useState(opening.location ?? "");
  const [storyGate, setStoryGate] = useState(opening.storyGate ?? []);
  const [overrides, setOverrides] = useState(opening.warningOverrides ?? []);
  const [lineList, setLineList] = useState(snippets);
  const [version, setVersion] = useState(0);
  // The picker starts on the post's own time when that is still ahead, else on the next free slot.
  const [schedule, setSchedule] = useState(
    localInput(
      initialPost.scheduledAt != null && initialPost.scheduledAt > referenceNow
        ? initialPost.scheduledAt
        : nextSlot,
    ),
  );
  const [notes, setNotes] = useState(initialNotes),
    [noteText, setNoteText] = useState(""),
    [noteSlide, setNoteSlide] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [busy, start] = useTransition(),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmPublish, setConfirmPublish] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(referenceNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const kind = queueKind(post),
    meta = metadata(post),
    published = post.status === "posted";
  const studioSnap = JSON.stringify({
    caption,
    hashtags,
    firstComment,
    altTexts,
    channelCopy,
    location,
    storyGate,
    overrides,
  });
  const [savedSnap, setSavedSnap] = useState(studioSnap);
  const issues = useMemo(() => {
    const found = checkStudioCopy({
      caption,
      hashtags,
      firstComment,
      variants: channelCopy,
      allowedNumbers: hub.numbers.map((item) => item.value),
      allowedText: [copyContext?.allowed, meta.facts].filter(Boolean).join("\n"),
      banned: hub.banned,
      voiceRules: hub.voiceRules,
      format:
        post.templateType === "reel"
          ? "reel"
          : post.templateType === "carousel"
            ? "carousel"
            : post.templateType === "ad"
              ? "photo"
              : "other",
      altTexts,
      storedHashtags: post.hashtags,
      primary: targetChannel(post) === "facebook" ? "facebook" : "instagram",
      altRequired: Boolean(openingInstagram),
    });
    return copyError
      ? [{ level: "block" as const, code: "provenance", message: copyError }, ...found]
      : found;
  }, [
    altTexts,
    caption,
    channelCopy,
    copyContext,
    copyError,
    firstComment,
    hashtags,
    hub,
    meta.facts,
    openingInstagram,
    post,
  ]);
  const blocks = issues.filter((issue) => issue.level === "block");
  const dirty = studioSnap !== savedSnap;
  const navigate = useCallback(
    (id?: string) => {
      const params = new URLSearchParams(query.toString());
      if (id) params.set("post", id);
      else params.delete("post");
      router.replace(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, query, router],
  );
  const index = viewIds.indexOf(post.id);
  const step = useCallback(
    (direction: number) => {
      const id = viewIds[index + direction];
      if (id && !busy) {
        if (dirty) {
          toast.error("Save changes before moving to another post");
          return;
        }
        navigate(id);
      }
    },
    [busy, dirty, index, navigate, viewIds],
  );
  const decide = useCallback(
    (approved: boolean, at?: number) => {
      if (busy || published) return;
      if (approved && at === undefined) {
        toast.error("Pick a time first");
        return;
      }
      if (approved && (dirty || blocks.length)) {
        toast.error(
          dirty
            ? "Save changes before approving"
            : "Resolve the blocked checks before approving",
        );
        return;
      }
      start(async () => {
        try {
          await (approved
            ? approvePost(post.id, post.projectId!, at)
            : declinePost(post.id, post.projectId!));
          const next = viewIds[index + 1] ?? viewIds[index - 1];
          navigate(next);
          toast.success(
            approved
              ? `Approved for ${formatDayTime(at)}`
              : "Post declined",
            {
              action: {
                label: "Undo",
                onClick: () => {
                  start(async () => {
                    try {
                      await undoDecision(
                        post.id,
                        post.projectId!,
                        post.status!,
                        post.scheduledAt,
                        approved ? "approved" : "declined",
                      );
                      navigate(post.id);
                      router.refresh();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Undo failed",
                      );
                    }
                  });
                },
              },
            },
          );
          router.refresh();
        } catch (e) {
          const message = e instanceof Error ? e.message : "Decision failed";
          setError(message);
          toast.error(message);
        }
      });
    },
    [
      busy,
      dirty,
      index,
      navigate,
      post,
      published,
      router,
      viewIds,
      blocks,
    ],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        confirmDelete ||
        confirmPublish ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return;
      const target = event.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable=true], video")
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "a" && !published) {
        event.preventDefault();
        // A approves only a post in review, at its own proposed time. No key ever publishes.
        if (timing(post, Date.now()) === "proposed")
          decide(true, post.scheduledAt!);
        else if (post.status === "pending")
          toast.error("Pick a time first, then use the Approve button");
      } else if (key === "d" && !published) {
        event.preventDefault();
        decide(false);
      } else if (key === "arrowright" || key === "j") {
        event.preventDefault();
        step(1);
      } else if (key === "arrowleft" || key === "k") {
        event.preventDefault();
        step(-1);
      } else if (key === "e") {
        event.preventDefault();
        captionRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [confirmDelete, confirmPublish, decide, post, published, step]);
  const run = (operation: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await operation();
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Action failed";
        setError(message);
        toast.error(message);
      }
    });
  const state = timing(post, now),
    picked = localTimestamp(schedule),
    pickedOk = Number.isFinite(picked) && picked > now,
    pickedLabel = pickedOk ? formatDayTime(picked) : "a time",
    inReview = !["approved", "failed", "posted"].includes(post.status ?? ""),
    moved = post.scheduledAt !== picked,
    zone = QUEUE_ZONE_LABEL;
  // The owner's open change requests: while one is open the post is with Claude.
  const requests = notes.filter((n) => !n.resolvedAt && n.author !== "claude"),
    slideCount = slidesFor(post).length;
  const sendNote = () =>
    run(async () => {
      const result = await requestPostChanges(
        post.id,
        post.projectId!,
        noteText,
        noteSlide || null,
      );
      setPost(result.post);
      setNotes(result.notes);
      setNoteText("");
      setNoteSlide(0);
      toast.success("Sent to Claude. The post waits until it is fixed.");
    });
  const platformName = targetChannel(post) === "facebook" ? "Facebook" : "Instagram";
  const publishNow = () =>
    run(async () => {
      const result = await (post.status === "failed"
        ? retryPublish(post.id, post.projectId!, "publish-now")
        : publishToInstagram(post.id, post.projectId!, "publish-now"));
      setConfirmPublish(false);
      if (!result.success) throw new Error(result.error);
      toast.success(`Published to ${platformName}`);
      navigate();
    });
  const facts = (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
      <dt className="text-muted-foreground">Kind</dt>
      <dd>{KIND_LABELS[kind]}</dd>
      <dt className="text-muted-foreground">Goes to</dt>
      <dd>
        {platformName === "Facebook"
          ? "Facebook only (not Instagram, not TikTok)"
          : "Instagram, then Facebook and TikTok"}
      </dd>
      <dt className="text-muted-foreground">Source</dt>
      <dd>{post.source || "Unknown"}</dd>
      <dt className="text-muted-foreground">Created</dt>
      <dd className="tabular-nums">{formatTime(post.createdAt)}</dd>
      {post.scheduledAt != null && (
        <>
          <dt className="text-muted-foreground">Scheduled</dt>
          <dd>{formatTime(post.scheduledAt)}</dd>
        </>
      )}
      {post.postedAt != null && (
        <>
          <dt className="text-muted-foreground">Published</dt>
          <dd>{formatTime(post.postedAt)}</dd>
        </>
      )}
      {post.permalink && (
        <>
          <dt className="text-muted-foreground">{platformName}</dt>
          <dd>
            <a
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View published post
            </a>
          </dd>
        </>
      )}
      {publications.map((p) => (
        <Fragment key={p.id}>
          <dt className="text-muted-foreground">
            {p.platform === "tiktok" ? "TikTok" : "Facebook"}
          </dt>
          <dd className="break-words">
            {p.status === "posted" ? (
              p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" className="underline">
                  View published post
                </a>
              ) : (
                "Published"
              )
            ) : p.status === "failed" ? (
              <span className="text-destructive">
                Failed: {p.error || "not accepted"}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={async () => {
                    const r = await retryCrosspost(p.id, post.projectId!);
                    if (r.ok) toast.success("Sent again");
                    else toast.error(r.error);
                    router.refresh();
                  }}
                >
                  Try again
                </button>
              </span>
            ) : (
              "Publishing"
            )}
          </dd>
        </Fragment>
      ))}
      {post.publishError && (
        <>
          <dt className="text-muted-foreground">Publish error</dt>
          <dd className="break-words text-destructive">{post.publishError}</dd>
        </>
      )}
    </dl>
  );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) navigate();
      }}
    >
      <SheetContent
        className="@container gap-0 overflow-hidden data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-none md:data-[side=right]:w-[min(1240px,calc(100vw-32px))]"
        style={
          {
            "--queue-accent": brandColor,
          } as React.CSSProperties
        }
      >
        <SheetHeader className="border-b border-border p-4 pr-14 md:p-5 md:pr-14">
          <SheetTitle className="text-sm font-medium">
            {postLabel(post)}
          </SheetTitle>
          <SheetDescription className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span>{KIND_LABELS[kind]}</span>
            <span aria-hidden="true">·</span>
            <StatusChip
              word={
                {
                  posted: "Posted",
                  scheduled: "Scheduled",
                  due: "Due",
                  failed: "Failed",
                  proposed: "Needs your OK",
                  "proposal-passed": "Time passed",
                  "no-time": "No time",
                  unplanned: "Needs your OK",
                  off: post.status === "declined" ? "Declined" : "Draft",
                }[state] ?? "Draft"
              }
            />
            {platformName === "Facebook" && (
              <span className="rounded-full border border-[#1877f2]/60 px-2 py-0.5 font-medium text-[#6ea8ff]">
                Facebook only
              </span>
            )}
            <span className="tabular-nums">
              {index >= 0
                ? `${index + 1} of ${viewIds.length} in ${listLabel}`
                : requests.length
                  ? "With Claude"
                  : ""}
            </span>
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-8 overflow-x-hidden overflow-y-auto p-4 md:p-5 @5xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_240px]">
          <ChannelPreview
            post={post}
            username={username}
            caption={caption}
            hashtags={hashtags}
            firstComment={firstComment}
            altText={altTexts.find((line) => line.trim()) ?? ""}
            variants={channelCopy}
            gridPosts={gridPosts}
            version={version}
          />
          <section className="min-w-0 space-y-5" aria-label="Edit and decide">
            <CaptionStudio
              caption={caption}
              hashtags={hashtags}
              onCaption={setCaption}
              onHashtags={setHashtags}
              firstComment={firstComment}
              onFirstComment={setFirstComment}
              altTexts={altTexts}
              onAltTexts={setAltTexts}
              variants={channelCopy}
              onVariants={setChannelCopy}
              location={location}
              onLocation={setLocation}
              issues={issues}
              overrides={overrides}
              onOverride={(code) =>
                setOverrides((current) => (current.includes(code) ? current : [...current, code]))
              }
              numbers={hub.numbers}
              related={hub.related}
              snippets={lineList}
              onCreateSnippet={(label, body) =>
                run(async () => {
                  const row = await createSnippet(post.projectId!, label, body, "line");
                  setLineList((current) =>
                    [...current, row].sort((a, b) => a.label.localeCompare(b.label)),
                  );
                })
              }
              storyItems={
                hub.checklist
              }
              storyGate={storyGate}
              onStoryGate={setStoryGate}
              copyMode={mode}
              onAsk={(instruction) =>
                run(async () => {
                  const result = await askForRewrite(post.id, post.projectId!, instruction);
                  setPost(result.post);
                  setNotes(result.notes);
                  toast.success(result.kind === "note" ? "Asked Claude to rewrite" : "Suggestion ready");
                })
              }
              blocked={busy || published}
              captionRef={captionRef}
            />
            {!published && (
              <Button
                onClick={() =>
                  run(async () => {
                    const updated = await saveQueuePost(post.id, post.projectId!, {
                      caption,
                      hashtags,
                      firstComment,
                      altTexts,
                      location,
                      storyGate,
                      warningOverrides: overrides,
                      variants: (["facebook", "tiktok", "x"] as StudioChannel[]).map((channel) => ({
                        channel,
                        caption: channelCopy[channel]?.caption ?? null,
                        hashtags: channelCopy[channel]?.hashtags ?? null,
                        firstComment: channelCopy[channel]?.firstComment ?? "",
                      })),
                    });
                    setPost(updated);
                    setSavedSnap(studioSnap);
                    setVersion(Date.now());
                    toast.success("Copy saved");
                  })
                }
                disabled={busy || !dirty || blocks.length > 0}
                className="w-full"
              >
                <Save />
                Save copy
              </Button>
            )}
            {dirty && (
              <p className="text-xs text-muted-foreground">
                Save changes before approving. Edited posts return to Review.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {(meta.facts || meta.altText) && (
              <details className="border-t border-border pt-2">
                <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">
                  Facts, sources and alt text
                  <ChevronDown className="ml-auto size-4" />
                </summary>
                <div className="space-y-3 pb-2 text-xs leading-5 text-muted-foreground">
                  {meta.facts && (
                    <p className="whitespace-pre-wrap break-words">
                      <span className="font-medium text-foreground">
                        Checked facts.{" "}
                      </span>
                      {meta.facts}
                    </p>
                  )}
                  {meta.altText && (
                    <p className="whitespace-pre-wrap break-words">
                      <span className="font-medium text-foreground">
                        Alt text.{" "}
                      </span>
                      {meta.altText}
                    </p>
                  )}
                </div>
              </details>
            )}
            {kbLinks.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">From the hub</h3>
                <ul className="space-y-1">
                  {kbLinks.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={`/projects/${post.projectId}/hub?entry=${link.id}`}
                        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <section
              className="space-y-3 border-t border-border pt-4"
              aria-label="Notes for Claude"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="size-4 text-muted-foreground" />
                Notes for Claude
              </h3>
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`space-y-1 rounded-lg border p-3 text-sm ${note.resolvedAt ? "border-border text-muted-foreground" : "border-[var(--queue-accent)]/40 bg-[var(--queue-accent)]/5"}`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {note.slide ? (
                      <span className="font-medium">Slide {note.slide}: </span>
                    ) : null}
                    {note.body}
                  </p>
                  {parseSuggestion(note.suggestion) && !note.resolvedAt ? (
                    <div className="space-y-2 rounded-md bg-background/70 p-2">
                      <p className="whitespace-pre-wrap break-words">{parseSuggestion(note.suggestion)?.text}</p>
                      <button
                        type="button"
                        className="min-h-10 underline"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const result = await acceptCaptionSuggestion(note.id, post.id, post.projectId!);
                            setPost(result.post);
                            setNotes(result.notes);
                            setCaption(result.post.caption ?? "");
                            setHashtags(result.post.hashtags ?? "");
                            setSavedSnap(
                              JSON.stringify({
                                caption: result.post.caption ?? "",
                                hashtags: result.post.hashtags ?? "",
                                firstComment,
                                altTexts,
                                channelCopy,
                                location,
                                storyGate,
                                overrides,
                              }),
                            );
                            toast.success("Suggestion accepted");
                          })
                        }
                      >
                        Accept
                      </button>
                    </div>
                  ) : null}
                  {note.reply && (
                    <p className="whitespace-pre-wrap break-words text-foreground">
                      <span className="font-medium">
                        {note.author === "claude" ? "You: " : "Claude: "}
                      </span>
                      {note.reply}
                    </p>
                  )}
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>
                      {note.author === "claude" ? "Claude" : "You"},{" "}
                      {formatTime(note.createdAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {note.resolvedAt
                        ? note.reply || note.author === "claude"
                          ? "Done"
                          : "Dismissed"
                        : note.author === "claude"
                          ? "For you"
                          : "Open, with Claude"}
                    </span>
                    {!note.resolvedAt && !published && (
                      <button
                        type="button"
                        disabled={busy}
                        className="ml-auto inline-flex min-h-10 items-center underline"
                        onClick={() =>
                          run(async () => {
                            setNotes(
                              await dismissNote(
                                note.id,
                                post.id,
                                post.projectId!,
                              ),
                            );
                          })
                        }
                      >
                        {note.author === "claude" ? "Got it" : "Never mind"}
                      </button>
                    )}
                  </p>
                </div>
              ))}
              {!published && (
                <>
                  <Textarea
                    ref={noteRef}
                    aria-label="Note for Claude"
                    placeholder="What should change? For example: the label on slide 3 is too small."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    disabled={busy}
                    className="min-h-20"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {slideCount > 1 && (
                      <select
                        aria-label="Which slide"
                        value={noteSlide}
                        onChange={(e) => setNoteSlide(Number(e.target.value))}
                        disabled={busy}
                        className="min-h-10 rounded-lg border border-input bg-field px-2 text-sm"
                      >
                        <option value={0}>Whole post</option>
                        {Array.from({ length: slideCount }, (_, i) => (
                          <option key={i} value={i + 1}>
                            Slide {i + 1}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      variant="outline"
                      className="min-h-10 flex-1"
                      disabled={busy || !noteText.trim()}
                      onClick={sendNote}
                    >
                      Request changes
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sending a note moves the post to “With Claude”. It cannot go
                    out until you approve it again.
                  </p>
                </>
              )}
            </section>
            {published && (
              <dl className="grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-5">
                {headlineNumbers(
                  storedInsights(post.insightsJson).metrics,
                  post.templateType === "reel",
                ).map((n) => (
                  <div key={n.label}>
                    <dt className="text-xs text-muted-foreground">{n.label}</dt>
                    <dd className="mt-1 text-sm font-medium tabular-nums">
                      {n.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="space-y-3 border-t border-border pt-4">
              {!published && (
                <>
                  <div
                    className={`space-y-3 rounded-xl border p-4 ${
                      state === "no-time" || state === "proposal-passed"
                        ? "border-amber-500/50 bg-amber-500/10"
                        : state === "failed"
                          ? "border-destructive/50 bg-destructive/10"
                          : "border-border bg-muted"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {state === "no-time" ||
                      state === "proposal-passed" ||
                      state === "failed" ? (
                        <TriangleAlert
                          className={`mt-0.5 size-4 shrink-0 ${state === "failed" ? "text-destructive" : "text-amber-500"}`}
                        />
                      ) : (
                        <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {
                            {
                              scheduled: "Scheduled. Goes out on its own at",
                              due: connected
                                ? "Due. Goes out at the next hourly run"
                                : `Due, but waiting: ${platformName} is not connected`,
                              "no-time": "Approved, but it has no time",
                              proposed: "Proposed time, waiting for your OK",
                              "proposal-passed": "The proposed time has passed",
                              unplanned: "No time proposed yet",
                              failed: "Publishing failed",
                              posted: "",
                              off:
                                post.status === "declined"
                                  ? "Declined. Approve it to bring it back"
                                  : "Draft",
                            }[state]
                          }
                        </p>
                        <p className="text-base font-medium tabular-nums">
                          {state === "no-time"
                            ? "It will not go out."
                            : state === "failed"
                              ? post.publishError || "Instagram did not accept it"
                              : post.scheduledAt != null
                                ? formatDayTime(post.scheduledAt)
                                : "Pick a time below"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="queue-schedule" className="text-xs">
                        {state === "scheduled" ? "Move to" : "Goes out"} (
                        {zone} time)
                      </Label>
                      <Input
                        id="queue-schedule"
                        type="datetime-local"
                        className="w-full min-w-0 max-w-full"
                        value={schedule}
                        min={localInput(now)}
                        onChange={(e) => setSchedule(e.target.value)}
                        disabled={busy}
                      />
                      {schedule !== localInput(nextSlot) && nextSlot > now && (
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center text-xs text-[var(--queue-accent)] underline"
                          onClick={() => setSchedule(localInput(nextSlot))}
                        >
                          Use the next free slot, {formatDayTime(nextSlot)}
                        </button>
                      )}
                      {!pickedOk && (
                        <p className="text-xs text-amber-500">
                          That time has passed. Pick a later one.
                        </p>
                      )}
                    </div>
                  </div>
                  {state === "scheduled" && !moved && (
                    <p className="text-xs text-muted-foreground">
                      Nothing to do. Change the time above to move it.
                    </p>
                  )}
                  {!connected && !inReview && (
                    <p className="text-xs text-muted-foreground">
                      {platformName} is not connected, so nothing goes out until you
                      reconnect.
                    </p>
                  )}
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" className="min-h-10" />}
                >
                  <MoreHorizontal />
                  More
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  {!published && (
                    <>
                      {(post.status === "approved" ||
                        post.status === "failed") && (
                        <DropdownMenuItem
                          onClick={() => setConfirmPublish(true)}
                          disabled={busy || dirty}
                          className="min-h-10"
                        >
                          {post.status === "failed"
                            ? "Retry now…"
                            : "Publish now…"}
                        </DropdownMenuItem>
                      )}
                      {post.status !== "declined" && (
                        <DropdownMenuItem
                          className="min-h-10"
                          disabled={busy}
                          onClick={() => decide(false)}
                        >
                          Decline
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="min-h-10"
                        disabled={busy || post.status === "pending"}
                        onClick={() =>
                          run(async () => {
                            await moveToQueue(post.id, post.projectId!);
                            setPost((p) => ({ ...p, status: "pending" }));
                            toast.success("Moved to Review");
                          })
                        }
                      >
                        Back to review
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="min-h-10"
                        disabled={busy || dirty}
                        onClick={() =>
                          run(async () => {
                            setPost(
                              await rerenderPost(post.id, post.projectId!),
                            );
                            setVersion(Date.now());
                            toast.success("Preview re-rendered");
                          })
                        }
                      >
                        Re-render
                      </DropdownMenuItem>
                    </>
                  )}
                  {!copyContext && !copyError && (
                    <DropdownMenuItem
                      className="min-h-10"
                      render={
                        <Link
                          href={`/projects/${post.projectId}/generate?postId=${post.id}`}
                        />
                      }
                    >
                      Open in full generator
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="min-h-10"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden border-t border-border pt-4 @3xl:block">
              {facts}
            </div>
            <details className="border-t border-border @3xl:hidden">
              <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">
                Details
                <ChevronDown className="ml-auto size-4" />
              </summary>
              <div className="pb-4">{facts}</div>
            </details>
            {activity.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Activity</h3>
                <ActivityList lines={activity} />
              </div>
            ) : null}
          </section>
          <aside className="hidden min-w-0 @5xl:block" aria-label="Checks">
            <CopyChecks
              issues={issues}
              overrides={overrides}
              onOverride={(code) =>
                setOverrides((current) => (current.includes(code) ? current : [...current, code]))
              }
            />
          </aside>
        </div>
        <footer className="space-y-2 border-t border-border px-4 py-3 md:px-5">
          {!published && (
            <p className="text-xs tabular-nums text-muted-foreground sm:hidden">
              {requests.length
                ? "With Claude. Waiting for the change you asked for."
                : pickedOk
                  ? `${inReview ? "Goes out" : state === "scheduled" && !moved ? "Scheduled" : "New time"} ${pickedLabel}`
                  : "Pick a time above"}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous post"
              disabled={busy || index <= 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next post"
              disabled={busy || index < 0 || index >= viewIds.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRight />
            </Button>
            <span className="mr-auto hidden text-xs text-muted-foreground lg:inline">
              A approve at the proposed time · ←/→ next · E edit · Esc close
            </span>
            <span className="mr-auto lg:hidden" />
            {published ? (
              post.permalink && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  nativeButton={false}
                  render={
                    <a href={post.permalink} target="_blank" rel="noreferrer" />
                  }
                >
                  Open on Instagram
                </Button>
              )
            ) : requests.length ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                With Claude. Waiting for the change you asked for.
              </span>
            ) : (
              <>
                {inReview && (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => {
                      noteRef.current?.scrollIntoView({ block: "center" });
                      noteRef.current?.focus();
                    }}
                  >
                    Request changes
                  </Button>
                )}
                {inReview || state === "failed" ? (
                  <Button
                    className="min-h-11 flex-1 sm:flex-none"
                    disabled={
                      busy || dirty || blocks.length > 0 || !pickedOk
                    }
                    onClick={() => decide(true, picked)}
                  >
                    <span className="sm:hidden">
                      {inReview ? "Approve" : "Try again then"}
                    </span>
                    <span className="hidden sm:inline">
                      {inReview ? "Approve for" : "Try again on"} {pickedLabel}
                    </span>
                  </Button>
                ) : (
                  (state !== "scheduled" || moved) && (
                    <Button
                      className="min-h-11 flex-1 sm:flex-none"
                      disabled={busy || !pickedOk}
                      onClick={() =>
                        run(async () => {
                          setPost(
                            await schedulePost(post.id, post.projectId!, picked),
                          );
                          toast.success(`Scheduled for ${pickedLabel}`);
                        })
                      }
                    >
                      <span className="sm:hidden">
                        {state === "scheduled" ? "Move" : "Schedule"}
                      </span>
                      <span className="hidden sm:inline">
                        {state === "scheduled" ? "Move to" : "Schedule for"}{" "}
                        {pickedLabel}
                      </span>
                    </Button>
                  )
                )}
              </>
            )}
          </div>
        </footer>
        <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
          <DialogContent>
            <DialogTitle>Publish to {platformName} right now?</DialogTitle>
            <DialogDescription>
              “{postLabel(post)}” goes live on {platformName === "Facebook" ? "the Facebook Page" : `@${username}`} immediately and
              cannot be taken back from here.
              {state === "scheduled" &&
                ` It is scheduled for ${formatDayTime(post.scheduledAt)}. Publishing now skips that time.`}
            </DialogDescription>
            {!connected && (
              <p className="text-sm text-amber-500">
                {platformName} is not connected, so this cannot publish. Reconnect
                first.
              </p>
            )}
            <DialogFooter>
              <Button autoFocus onClick={() => setConfirmPublish(false)}>
                {state === "scheduled" ? "Keep the schedule" : "Cancel"}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !connected}
                onClick={publishNow}
              >
                Yes, publish now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This removes it from AdForge. A published Instagram post stays on
              Instagram.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deletePost(post.id, post.projectId!);
                    setConfirmDelete(false);
                    navigate();
                    toast.success("Post deleted");
                  })
                }
              >
                Delete post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function seedAlts(post: QueuePost, stored: string | null | undefined): string[] {
  const count = post.templateType === "carousel" ? Math.max(slidesFor(post).length, 1) : 1;
  const parsed = parseAltTexts(stored);
  if (parsed) return Array.from({ length: count }, (_, index) => parsed[index] ?? "");
  const shared = metadata(post).altText ?? "";
  return Array.from({ length: count }, () => shared);
}

function seedVariants(rows: VariantRow[]): VariantState {
  const state: VariantState = {};
  for (const row of rows) {
    if (row.channel === "facebook" || row.channel === "tiktok" || row.channel === "x") {
      state[row.channel] = {
        caption: row.caption,
        hashtags: row.hashtags,
        firstComment: row.firstComment ?? "",
      };
    }
  }
  return state;
}
