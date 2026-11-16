import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportReport } from "@/components/results/ExportReport";
import { getBrandKitFields } from "@/lib/brand-kit";
import { sqlite } from "@/lib/db";
import { assembleResults } from "@/lib/results-assemble";
import { compareCount, mondayOf, shiftDay } from "@/lib/results";
import { accountSpan, postSpan, weeklyReportMarkdown } from "@/lib/results-screen";
import { loadResultSources } from "@/lib/results-store";

export const dynamic = "force-dynamic";

export default async function WeekReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sources = loadResultSources(sqlite, id);
  if (!sources) notFound();
  const kit = await getBrandKitFields(id);
  const base = `/projects/${id}`;
  const model = assembleResults(
    sources,
    kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label })),
    now,
    { plan: `${base}/plan`, post: (postId) => `${base}/queue?post=${postId}` },
  );
  const requested = search.week && /^\d{4}-\d{2}-\d{2}$/.test(search.week) ? search.week : model.weekStart;
  const start = mondayOf(requested);
  const end = shiftDay(start, 6);
  const posts = model.posts.filter((post) => post.day >= start && post.day <= end);
  const account = accountSpan(sources.days, "instagram", start, end);
  const previous = accountSpan(sources.days, "instagram", shiftDay(start, -7), shiftDay(start, -1));
  const fromPosts = postSpan(posts, start, end);
  const reach = account.reach ?? fromPosts.reach;
  const markdown = weeklyReportMarkdown({
    weekStart: start,
    weekEnd: end,
    followers: account.followers,
    followsGained: fromPosts.follows,
    reach,
    views: account.views ?? fromPosts.views,
    profileViews: account.profileViews ?? fromPosts.profileViews,
    linkTaps: account.websiteTaps,
    posts,
    whatChanged: compareCount("Reach", { current: reach, previous: previous.reach }).text,
    reading: model.takeaways.map((item) => `${item.text} ${item.numbers}`).join(" ") || "No takeaway yet.",
    nextSentence: "",
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={`${base}/results`} className="underline-offset-2 hover:underline">
              Results
            </Link>
          </p>
          <h1 className="text-[28px] font-medium tracking-tight">Week of {start}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`${base}/results/report?week=${shiftDay(start, -7)}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Previous
          </Link>
          <Link
            href={`${base}/results/report?week=${shiftDay(start, 7)}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Next
          </Link>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border p-4 text-[13px] leading-6">
        {markdown}
      </pre>
      <ExportReport projectId={id} week={start} />
    </div>
  );
}
