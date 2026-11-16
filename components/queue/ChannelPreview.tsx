"use client";

import { useState } from "react";
import { InstagramPreview } from "./InstagramPreview";
import {
  channelBody,
  channelName,
  CHANNEL_LIMITS,
  resolvedFields,
  type StudioChannel,
} from "@/lib/studio-check";
import type { QueuePost } from "@/lib/queue-view";

const TABS: StudioChannel[] = ["instagram", "facebook", "tiktok", "x"];

export function ChannelPreview({
  post,
  username,
  caption,
  hashtags,
  firstComment,
  altText,
  variants,
  version,
  gridPosts,
}: {
  post: QueuePost;
  username: string;
  caption: string;
  hashtags: string;
  firstComment: string;
  altText: string;
  variants: Partial<Record<StudioChannel, { caption: string | null; hashtags: string | null }>>;
  version: number;
  gridPosts: QueuePost[];
}) {
  const [channel, setChannel] = useState<StudioChannel>("instagram");
  const fields =
    channel === "instagram"
      ? { caption, hashtags }
      : resolvedFields({ caption, hashtags }, variants[channel]);
  const text = channelBody(fields.caption, fields.hashtags);
  const differs = channel !== "instagram" && (variants[channel]?.caption != null || variants[channel]?.hashtags != null);
  return (
    <section className="mx-auto w-full min-w-0 max-w-[420px] space-y-3" aria-label="Channel preview">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Preview channel">
        {TABS.map((tab) => {
          const own = tab !== "instagram" && (variants[tab]?.caption != null || variants[tab]?.hashtags != null);
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={channel === tab}
              onClick={() => setChannel(tab)}
              className={`min-h-10 flex-1 rounded-lg px-1 py-2 text-xs focus-visible:outline-2 ${channel === tab ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              {channelName(tab)}
              {own ? <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">Differs</span> : null}
            </button>
          );
        })}
      </div>
      {channel === "instagram" ? (
        <InstagramPreview
          post={post}
          username={username}
          caption={caption}
          hashtags={hashtags}
          gridPosts={gridPosts}
          version={version}
          firstComment={firstComment}
          altText={altText}
        />
      ) : (
        <ChannelCard
          channel={channel}
          username={username}
          text={text}
          firstComment={firstComment}
          differs={differs}
        />
      )}
    </section>
  );
}

function ChannelCard({
  channel,
  username,
  text,
  firstComment,
  differs,
}: {
  channel: StudioChannel;
  username: string;
  text: string;
  firstComment: string;
  differs: boolean;
}) {
  const [open, setOpen] = useState(false);
  const limit = channel === "x" ? 280 : channel === "tiktok" ? 80 : 125;
  const chars = Array.from(text);
  const cut = !open && chars.length > limit;
  const shown = cut ? chars.slice(0, limit).join("") : text;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="font-medium">{channelName(channel)}</span>
        <span className={`tabular-nums ${chars.length > CHANNEL_LIMITS[channel] ? "text-destructive" : "text-muted-foreground"}`}>
          {chars.length.toLocaleString()} / {CHANNEL_LIMITS[channel].toLocaleString()}
        </span>
      </div>
      <div className="space-y-2 px-3 py-3 text-sm leading-5">
        <p className="text-xs text-muted-foreground">@{username}</p>
        <p className="whitespace-pre-wrap break-words">
          {shown || "Your caption appears here."}
          {cut ? "..." : ""}
        </p>
        {chars.length > limit ? (
          <button type="button" className="min-h-10 text-xs text-muted-foreground underline" onClick={() => setOpen((value) => !value)}>
            {open ? "less" : "more"}
          </button>
        ) : null}
        {firstComment ? <p className="text-xs text-muted-foreground">First comment: {firstComment}</p> : null}
        <p className="text-xs text-muted-foreground">{differs ? "This channel has its own text." : "Same as the main caption until you edit it."}</p>
      </div>
    </div>
  );
}
