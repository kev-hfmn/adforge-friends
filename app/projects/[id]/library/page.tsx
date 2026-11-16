import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/drizzle/schema";
import { AssetUpload } from "@/components/AssetUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSET_KINDS,
  assetUsage,
  dayText,
  isClip,
  KIND_NAMES,
  listAssets,
  type AssetKind,
} from "@/lib/assets";
import { deleteAsset, editAsset } from "./actions";

export const dynamic = "force-dynamic";

/** Reusable media, captured once and tagged, so posts can draw from it for weeks. */
export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; tag?: string; feature?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!project) notFound();
  const all = await listAssets(id);
  const kind = ASSET_KINDS.includes(search.kind as AssetKind)
    ? search.kind
    : undefined;
  const shown = all.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!search.tag || a.tags.includes(search.tag)) &&
      (!search.feature || a.feature === search.feature),
  );
  const usage = await assetUsage(
    id,
    shown.map((a) => a.path),
  );
  const count = <T,>(items: T[]) => {
    const map = new Map<T, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]);
  };
  const features = count(all.flatMap((a) => (a.feature ? [a.feature] : [])));
  const tags = count(all.flatMap((a) => a.tags));
  const href = (updates: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      kind,
      tag: search.tag,
      feature: search.feature,
      ...updates,
    }))
      if (value) query.set(key, value);
    const text = query.toString();
    return `/projects/${id}/library${text ? `?${text}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "border-[var(--project-accent)] bg-[var(--project-accent)]/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;
  const today = new Date().toISOString().slice(0, 10);
  const filtered = !!(kind || search.tag || search.feature);
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {all.length
            ? `${all.length} ${all.length === 1 ? "file" : "files"}, newest first.`
            : "Screenshots, photos, charts and clips you want to use again."}{" "}
          Tag them once and they can be found for weeks.
        </p>
      </header>
      <details open={all.length === 0} className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted group-open:mb-3">
          Add files
        </summary>
        <AssetUpload
          projectId={id}
          kinds={ASSET_KINDS.map((k) => ({
            value: k,
            label: KIND_NAMES[k].replace(/s$/, ""),
          }))}
          today={today}
        />
      </details>
      {all.length > 0 && (
        <nav aria-label="Filter the library" className="space-y-2">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <Link href={href({ kind: undefined })} className={chip(!kind)}>
              All kinds
            </Link>
            {ASSET_KINDS.filter((k) => all.some((a) => a.kind === k)).map(
              (k) => (
                <Link
                  key={k}
                  href={href({ kind: kind === k ? undefined : k })}
                  className={chip(kind === k)}
                >
                  {KIND_NAMES[k]}
                  <span className="tabular-nums text-muted-foreground">
                    {all.filter((a) => a.kind === k).length}
                  </span>
                </Link>
              ),
            )}
          </div>
          {(features.length > 0 || tags.length > 0) && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {features.map(([feature, n]) => (
                <Link
                  key={`f-${feature}`}
                  href={href({
                    feature: search.feature === feature ? undefined : feature,
                  })}
                  className={chip(search.feature === feature)}
                >
                  {feature}
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </Link>
              ))}
              {tags.map(([tag, n]) => (
                <Link
                  key={`t-${tag}`}
                  href={href({ tag: search.tag === tag ? undefined : tag })}
                  className={chip(search.tag === tag)}
                >
                  #{tag}
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      )}
      {shown.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {filtered ? (
            <>
              Nothing matches these filters.{" "}
              <Link
                href={`/projects/${id}/library`}
                className="inline-flex min-h-11 items-center text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Clear filters
              </Link>
            </>
          ) : (
            "Nothing here yet. Add the first files above."
          )}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((asset) => (
            <li
              key={asset.id}
              className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
            >
              <a
                href={asset.path}
                target="_blank"
                rel="noreferrer"
                className="block aspect-[4/5] bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`Open ${asset.feature || asset.kind} in full size`}
              >
                {isClip(asset.path) ? (
                  <video
                    src={asset.path}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.path}
                    alt={[asset.feature, ...asset.tags].filter(Boolean).join(", ")}
                    loading="lazy"
                    className="size-full object-cover object-top"
                  />
                )}
              </a>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-medium">
                  {asset.feature || KIND_NAMES[asset.kind as AssetKind]?.replace(/s$/, "") || "File"}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {dayText(asset.capturedAt)}
                  {usage.get(asset.path)
                    ? ` · used in ${usage.get(asset.path)} ${usage.get(asset.path) === 1 ? "post" : "posts"}`
                    : ""}
                </p>
                {asset.tags.length > 0 && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {asset.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
                <details className="pt-1">
                  <summary className="flex min-h-10 cursor-pointer items-center text-xs underline">
                    Edit labels
                  </summary>
                  <form
                    action={editAsset.bind(null, asset.id, id)}
                    className="space-y-2 pb-2"
                  >
                    <select
                      name="kind"
                      aria-label="Kind"
                      defaultValue={asset.kind ?? "screenshot"}
                      className="min-h-10 w-full rounded-lg border border-input bg-field px-2 text-sm"
                    >
                      {ASSET_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {KIND_NAMES[k].replace(/s$/, "")}
                        </option>
                      ))}
                    </select>
                    <Input
                      name="feature"
                      aria-label="Feature or topic"
                      placeholder="Feature or topic"
                      defaultValue={asset.feature ?? ""}
                    />
                    <Input
                      name="tags"
                      aria-label="Tags, comma separated"
                      placeholder="Tags, comma separated"
                      defaultValue={asset.tags.join(", ")}
                    />
                    <Input
                      name="capturedOn"
                      type="date"
                      aria-label="Captured on"
                      defaultValue={dayText(asset.capturedAt)}
                    />
                    <Input
                      name="note"
                      aria-label="Note"
                      placeholder="Note"
                      defaultValue={asset.note ?? ""}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="min-h-10 flex-1">
                        Save
                      </Button>
                      <Button
                        type="submit"
                        variant="outline"
                        className="min-h-10"
                        formAction={deleteAsset.bind(null, asset.id, id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Remove takes it out of the library. Posts that already use
                      it keep working.
                    </p>
                  </form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
