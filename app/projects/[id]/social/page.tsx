import { db } from "@/lib/db";
import { socialChannels } from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { disconnectInstagram } from "./actions";
import Link from "next/link";
import { connectionState } from "@/lib/queue-view";

const SERVICE_CHANNELS = [
  {
    platform: "tiktok",
    label: "TikTok",
    gets: "Reels and carousels, the moment they go live on Instagram.",
    needs: "ZERNIO_API_KEY",
    connect: (id: string) => `/api/auth/zernio?projectId=${id}&platform=tiktok`,
  },
  {
    platform: "facebook",
    label: "Facebook Page",
    gets: "Every post, the moment it goes live on Instagram.",
    needs: "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET",
    connect: (id: string) => `/api/auth/facebook?projectId=${id}`,
  },
] as const;

export default async function SocialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const serviceChannels = await db.query.socialChannels.findMany({
    where: and(eq(socialChannels.projectId, id), inArray(socialChannels.provider, ["zernio", "meta"])),
  });
  const ready: Record<string, boolean> = {
    tiktok: !!process.env.ZERNIO_API_KEY,
    facebook: !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET,
  };
  const channel = await db.query.socialChannels.findFirst({
    where: and(
      eq(socialChannels.projectId, id),
      eq(socialChannels.platform, "instagram"),
    ),
  });

  const connection = connectionState(channel);

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Social</h2>
        <p className="text-sm text-muted-foreground">
          Connect this project&apos;s own accounts. An approved post goes to Instagram first,
          then to the TikTok and Facebook accounts connected here.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {channel ? (
        <section
          aria-label="Instagram account"
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between md:p-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-sm font-medium">
              {channel.igUsername?.[0]?.toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <p className="break-all text-sm font-medium">
                @{channel.igUsername}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                {connection.label}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-10"
              nativeButton={false} render={<Link href={`/api/auth/instagram?projectId=${id}`} />}
            >
              Reconnect
            </Button>
            <form action={disconnectInstagram.bind(null, channel.id, id)}>
              <Button variant="ghost" className="min-h-10 text-destructive">
                Disconnect
              </Button>
            </form>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect Instagram to publish your approved posts.
          </p>
          <Button
            className="min-h-10"
            nativeButton={false} render={<Link href={`/api/auth/instagram?projectId=${id}`} />}
          >
            Connect Instagram
          </Button>
        </div>
      )}
      {SERVICE_CHANNELS.map(({ platform, label, gets, needs, connect }) => {
        const linked = serviceChannels.find((c) => c.platform === platform);
        const zernioReady = ready[platform];
        return (
          <section
            key={platform}
            aria-label={label}
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between md:p-5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {label}
                {linked && (
                  <span className="ml-2 break-all font-normal text-muted-foreground">
                    @{linked.igUsername}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {linked
                  ? gets
                  : zernioReady
                    ? `Not connected. ${gets}`
                    : `Needs ${needs} on the server first.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {zernioReady && (
                <Button
                  variant={linked ? "outline" : "default"}
                  className="min-h-10"
                  nativeButton={false}
                  render={<Link href={connect(id)} />}
                >
                  {linked ? "Reconnect" : `Connect ${label}`}
                </Button>
              )}
              {linked && (
                <form action={disconnectInstagram.bind(null, linked.id, id)}>
                  <Button variant="ghost" className="min-h-10 text-destructive">
                    Disconnect
                  </Button>
                </form>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
