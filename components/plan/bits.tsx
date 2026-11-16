import { Clapperboard, GalleryHorizontal, ImageIcon } from "lucide-react";
import { QueueImage } from "@/components/queue/Media";
import { StatusChip } from "@/components/studio/StatusChip";
import { formatLabel, type PlanCard, type PlanChannel, type PlanFormat } from "@/lib/plan";

const LETTER: Record<PlanChannel["id"], string> = {
  instagram: "IG",
  facebook: "FB",
  tiktok: "TT",
};
const FULL: Record<PlanChannel["id"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};
const FORMAT_ICON: Record<PlanFormat, typeof ImageIcon> = {
  reel: Clapperboard,
  carousel: GalleryHorizontal,
  photo: ImageIcon,
};

export function FormatIcon({
  format,
  className = "size-3.5",
}: {
  format: PlanFormat;
  className?: string;
}) {
  const Icon = FORMAT_ICON[format] ?? ImageIcon;
  return <Icon className={className} aria-hidden />;
}

export { StatusChip };

export function Channels({
  channels,
  words = false,
}: {
  channels: PlanChannel[];
  words?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {channels.map((channel) => (
        <span
          key={channel.id}
          title={`${FULL[channel.id]}, ${channel.state}`}
          className={`inline-flex items-center gap-1 text-xs ${
            channel.state === "failed"
              ? "text-destructive"
              : channel.state === "sent"
                ? "text-muted-foreground"
                : "text-foreground"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              channel.state === "failed"
                ? "bg-destructive"
                : channel.state === "sent"
                  ? "bg-muted-foreground"
                  : "bg-[var(--queue-accent)]"
            }`}
            aria-hidden
          />
          {words ? FULL[channel.id] : LETTER[channel.id]}
        </span>
      ))}
    </span>
  );
}

export function Thumb({
  card,
  cover = false,
  className = "w-9",
}: {
  card: Pick<PlanCard, "imagePath" | "label" | "format">;
  cover?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-sm bg-muted ${className}`}
      style={{ aspectRatio: "4 / 5" }}
    >
      <span className="absolute inset-0 grid place-items-center text-muted-foreground">
        <FormatIcon format={card.format} className="size-4" />
      </span>
      <QueueImage
        src={card.imagePath}
        alt=""
        fit={cover ? "cover" : "contain"}
        compact
        className="bg-transparent"
      />
    </span>
  );
}

export function cardLabel(card: PlanCard): string {
  const bits = [
    card.time,
    card.label,
    formatLabel(card.format, card.slides),
    card.word,
    card.notes > 0 ? `${card.notes} ${card.notes === 1 ? "note" : "notes"}` : "",
  ].filter(Boolean);
  return bits.join(", ");
}
