import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { RefreshStats } from "@/components/queue/RefreshStats";
import { ResultsBoard } from "@/components/results/ResultsBoard";
import { SaveStoredReading } from "@/components/results/SaveStoredReading";
import { getBrandKitFields } from "@/lib/brand-kit";
import { sqlite } from "@/lib/db";
import { assembleResults } from "@/lib/results-assemble";
import { loadResultSources, syncAgedHub } from "@/lib/results-store";
import { createIdeaFromTakeaway } from "../ideas/actions";

export const dynamic = "force-dynamic";

const section = "text-base font-medium";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const kitPromise = getBrandKitFields(id);
  const sources = loadResultSources(sqlite, id);
  if (!sources) notFound();
  after(() => {
    try {
      syncAgedHub(sqlite, id, now);
    } catch {
      // A hub recount must not block Results.
    }
  });
  const kit = await kitPromise;
  const base = `/projects/${id}`;
  const model = assembleResults(
    sources,
    kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label })),
    now,
    { plan: `${base}/plan`, post: (postId) => `${base}/queue?post=${postId}` },
  );
  const tooFew = model.lines.some((line) => line.tooFew);
  const facebookDays = sources.days.filter((day) => day.channel === "facebook");
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-medium tracking-tight">Results</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Numbers already stored for {sources.project.name}. This page does not call Instagram, Facebook or TikTok.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${base}/results/report`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            Weekly report
          </Link>
          {sources.instagramConnected ? (
            <RefreshStats projectId={id} connected />
          ) : (
            <SaveStoredReading projectId={id} />
          )}
        </div>
      </header>

      <section id="overview" className="space-y-3" aria-labelledby="results-overview">
        <h2 id="results-overview" className={section}>
          Since last week
        </h2>
        <ul className="space-y-1 text-sm tabular-nums">
          {model.lines.map((line) => (
            <li key={line.text}>{line.text}</li>
          ))}
        </ul>
        {tooFew ? (
          <p className="text-sm text-muted-foreground">Too few to compare as a percentage.</p>
        ) : null}
        {model.followerDays.length ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            Followers by day:{" "}
            {model.followerDays
              .map((day) => `${day.day.slice(5)} ${day.followers == null ? "n/a" : day.followers}`)
              .join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No account day stored yet.</p>
        )}
        <p className="text-sm text-muted-foreground">
          {facebookDays.length
            ? `Facebook has ${facebookDays.length} stored days.`
            : sources.facebookConnected
              ? "No Facebook numbers stored yet."
              : "Facebook Page insights are not on this copy. The token is blank, so nothing was invented."}
        </p>
      </section>

      <section id="posts" className="space-y-3" aria-labelledby="results-posts">
        <h2 id="results-posts" className={section}>
          Posts
        </h2>
        {model.rows.length ? (
          <ResultsBoard
            rows={model.rows}
            curves={model.curves}
            brand={sources.project.brandColor}
            queueBase={`${base}/queue?post=`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing posted yet. Approve a post on Plan and it shows here after it goes out.
          </p>
        )}
      </section>

      <section id="works" className="space-y-4" aria-labelledby="results-works">
        <div>
          <h2 id="results-works" className={section}>
            What works
          </h2>
          <p className="text-sm text-muted-foreground">
            Medians from posts that have a number. Cells under 3 posts are grey.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {model.works.map((table) => (
            <div key={table.title} className="space-y-2">
              <h3 className="text-sm font-medium">{table.title}</h3>
              {table.cells.length ? (
                <table className="w-full text-left text-[13px] tabular-nums">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 font-medium">Group</th>
                      <th className="py-1 font-medium">Posts</th>
                      <th className="py-1 font-medium">Median reach</th>
                      <th className="py-1 font-medium">Sends per reach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.cells.map((cell) => (
                      <tr key={cell.label} className={cell.grey ? "text-muted-foreground" : undefined}>
                        <th className="py-1 pr-2 font-normal">{cell.label}</th>
                        <td className="py-1">{cell.sample}</td>
                        <td className="py-1">{cell.medianReach ?? "n/a"}</td>
                        <td className="py-1">
                          {cell.grey
                            ? "under 3"
                            : cell.medianReach != null && cell.medianReach < 100
                              ? "too few"
                              : cell.medianSendsPerReach == null
                                ? "n/a"
                                : `${Math.round(cell.medianSendsPerReach * 1000) / 10} per 100`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No groups yet. They appear once 3 posts share a format or a pillar.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="takeaways" className="space-y-3" aria-labelledby="results-takeaways">
        <h2 id="results-takeaways" className={section}>
          Takeaways
        </h2>
        {model.takeaways.length ? (
        <ul className="divide-y divide-border/60 border-y border-border">
          {model.takeaways.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0 space-y-1">
                <span className="block text-sm">{item.text}</span>
                <span className="block text-xs tabular-nums text-muted-foreground">{item.numbers}</span>
              </span>
              <span className="flex flex-wrap items-center gap-3">
                {item.idea ? (
                  <form action={createIdeaFromTakeaway}>
                    <input type="hidden" name="projectId" value={id} />
                    <input type="hidden" name="postId" value={item.idea.postId} />
                    <input type="hidden" name="mode" value={item.idea.mode} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {item.idea.label}
                    </button>
                  </form>
                ) : null}
                <Link
                  href={item.action.href}
                  className="inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.action.label}
                </Link>
              </span>
            </li>
          ))}
        </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No takeaway yet. It shows up after a few posts have numbers.
          </p>
        )}
      </section>
    </div>
  );
}
