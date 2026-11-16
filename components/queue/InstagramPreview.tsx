"use client";

import { useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { QueueImage } from "./Media";
import {
  mediaRatio,
  postLabel,
  slidesFor,
  type QueuePost,
} from "@/lib/queue-view";

export function InstagramPreview({
  post,
  username,
  caption,
  hashtags,
  gridPosts,
  version,
  firstComment = "",
  altText = "",
}: {
  post: QueuePost;
  username: string;
  caption: string;
  hashtags: string;
  gridPosts: QueuePost[];
  version: number;
  firstComment?: string;
  altText?: string;
}) {
  const [mode, setMode] = useState("feed"),
    [slide, setSlide] = useState(0),
    [expanded, setExpanded] = useState(false);
  const touch = useRef<number | null>(null);
  const slides = slidesFor(post);
  const paths = slides.length
    ? slides.map((s) => s.imagePath)
    : [post.imagePath];
  const change = (step: number) =>
    setSlide((i) => (i + step + paths.length) % paths.length);
  const text = [caption, hashtags].filter(Boolean).join("\n\n");
  const src = paths[slide];
  return (
    <section className="mx-auto w-full min-w-0 max-w-[420px] space-y-4" aria-label="Instagram preview">
      <div
        className="flex justify-center gap-1 rounded-lg bg-muted p-1"
        role="group"
        aria-label="Preview mode"
      >
        {["feed", "grid"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-xs transition-colors focus-visible:outline-2 ${mode === m ? "bg-background text-foreground" : "text-muted-foreground hover:bg-surface-hover"}`}
          >
            {m === "feed" ? "Instagram feed" : "Profile grid"}
          </button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-[#fafafa] text-[#181818]">
        <div className="flex items-center gap-2 border-b border-black/10 p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e4e7e9] text-sm font-semibold">
            {username[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 break-all text-xs font-medium">
            @{username}
          </span>
          <MoreHorizontal className="size-5" aria-hidden />
        </div>
        {mode === "grid" ? (
          <>
            <div className="px-4 py-6 text-sm font-medium">@{username}</div>
            <div className="grid grid-cols-3 gap-0.5">
              {[post, ...gridPosts.filter((p) => p.id !== post.id)]
                .slice(0, 9)
                .map((p, i) => (
                  <div
                    key={p.id}
                    className="relative aspect-[3/4] overflow-hidden bg-[#e4e7e9]"
                  >
                    <QueueImage
                      key={`${p.id}-${version}`}
                      src={
                        p.imagePath && p.id === post.id
                          ? `${p.imagePath}?v=${version}`
                          : p.imagePath
                      }
                      alt={postLabel(p)}
                      fit="cover"
                      compact
                    />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-xs font-medium text-[#181818]">
                        This post
                      </span>
                    )}
                  </div>
                ))}
            </div>
            <p className="px-4 py-3 text-xs text-[#666]">
              First in the grid, beside the latest approved and published posts.
            </p>
          </>
        ) : (
          <>
            <div
              className="relative overflow-hidden bg-[#e4e7e9]"
              style={{ aspectRatio: mediaRatio(post) }}
              onTouchStart={(e) => {
                touch.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touch.current == null || paths.length < 2) return;
                const dx = e.changedTouches[0].clientX - touch.current;
                if (Math.abs(dx) > 35) change(dx < 0 ? 1 : -1);
                touch.current = null;
              }}
            >
              {post.templateType === "reel" && post.videoPath ? (
                <video
                  key={post.videoPath}
                  src={post.videoPath}
                  poster={post.imagePath ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  className="h-full w-full object-contain"
                />
              ) : (
                <QueueImage
                  key={`${src}-${version}`}
                  src={
                    src
                      ? `${src}${src.includes("?") ? "&" : "?"}v=${version}`
                      : null
                  }
                  alt={`${postLabel(post)}, slide ${slide + 1}`}
                />
              )}
            </div>
            {paths.length > 1 && (
              <div className="flex items-center justify-between gap-1 px-1 py-1">
                <button
                  aria-label="Previous slide"
                  onClick={() => change(-1)}
                  className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex min-w-0 items-center justify-center">
                  {paths.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Slide ${i + 1}`}
                      aria-pressed={slide === i}
                      onClick={() => setSlide(i)}
                      className="grid h-10 w-5 place-items-center rounded-full focus-visible:outline-2"
                    >
                      <span
                        className={`size-1.5 rounded-full ${slide === i ? "bg-[var(--queue-accent)]" : "bg-[#b5b5b5]"}`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs tabular-nums text-[#737373]">
                    {slide + 1}/{paths.length}
                  </span>
                </div>
                <button
                  aria-label="Next slide"
                  onClick={() => change(1)}
                  className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
            <div
              className="flex items-center gap-4 px-3 py-3"
              aria-label="Instagram actions preview"
            >
              <Heart className="size-5" />
              <MessageCircle className="size-5" />
              <Send className="size-5" />
              <Bookmark className="ml-auto size-5" />
            </div>
            <div className="px-3 pb-5 text-xs leading-5">
              <p
                className={`whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-3"}`}
              >
                <strong>{username} </strong>
                {text || "Your caption appears here."}
              </p>
              {text.length > 100 || text.includes("\n") ? (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 min-h-10 text-[#737373] hover:underline focus-visible:outline-2"
                >
                  {expanded ? "less" : "… more"}
                </button>
              ) : null}
              {firstComment ? <p className="mt-2 text-[#737373]">First comment: {firstComment}</p> : null}
              {altText ? <p className="mt-2 text-[#737373]">Alt: {altText}</p> : null}
            </div>
          </>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Rendered media at its original ratio. Caption changes preview live.
      </p>
    </section>
  );
}
