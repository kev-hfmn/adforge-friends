"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { mediaRatio, postLabel, type QueuePost } from "@/lib/queue-view";

export function QueueImage({
  src,
  alt,
  className = "",
  fit = "contain",
  compact = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fit?: "contain" | "cover";
  /** Small thumbs stay a plain block. The full preview still says what to do. */
  compact?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // A server-rendered image can finish loading before React attaches onLoad, and then
  // the event never arrives. So the image is never hidden while "loading", and the
  // loading shimmer is cleared by checking the element itself.
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const done = () => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) setState("ready");
    };
    done();
    const timer = setTimeout(done, 1500);
    return () => clearTimeout(timer);
  }, [src]);
  return (
    <div className={`relative h-full w-full bg-muted ${className}`}>
      {state === "loading" && src && (
        <div
          className="absolute inset-0 animate-pulse bg-muted"
          aria-label="Loading preview"
        />
      )}
      {src && state !== "error" ? (
        <Image
          unoptimized
          fill
          sizes="(max-width: 1280px) 360px, 390px"
          src={src}
          alt={alt}
          ref={imgRef}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={fit === "cover" ? "object-cover" : "object-contain"}
        />
      ) : compact ? null : (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
          {src
            ? "Preview unavailable. Re-render to restore it."
            : "No rendered preview yet."}
        </div>
      )}
    </div>
  );
}
export function Cover({
  post,
  version,
}: {
  post: QueuePost;
  version?: number;
}) {
  const path = post.imagePath;
  const src =
    path && version
      ? `${path}${path.includes("?") ? "&" : "?"}v=${version}`
      : path;
  return (
    <div
      className="relative w-full overflow-hidden bg-muted"
      style={{ aspectRatio: mediaRatio(post) }}
    >
      <QueueImage key={src} src={src} alt={postLabel(post)} />
      {post.templateType === "reel" && (
        <span
          className="absolute bottom-3 right-3 rounded-full bg-background/85 p-2"
          aria-label="Reel"
        >
          <Play className="size-4" />
        </span>
      )}
    </div>
  );
}
export function Status({ status }: { status: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${status === "failed" ? "bg-destructive" : status === "approved" || status === "posted" ? "bg-[var(--queue-accent)]" : "bg-muted-foreground"}`}
      />
      {status === "posted" ? "Published" : (status ?? "draft")}
    </span>
  );
}
