// Weekly report text from stored rows. Writing the file is a separate step.
import fs from "node:fs/promises";
import path from "node:path";
import { getBrandKitFields } from "@/lib/brand-kit";
import { sqlite } from "@/lib/db";
import { assembleResults } from "@/lib/results-assemble";
import { compareCount, mondayOf, shiftDay } from "@/lib/results";
import { accountSpan, postSpan, weeklyReportMarkdown } from "@/lib/results-screen";
import { loadResultSources } from "@/lib/results-store";

export async function buildWeekReport(projectId: string, week: string, sentence = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("Pick a week");
  const sources = loadResultSources(sqlite, projectId);
  if (!sources) throw new Error("Project not found");
  const start = mondayOf(week);
  const end = shiftDay(start, 6);
  const kit = await getBrandKitFields(projectId);
  const model = assembleResults(
    sources,
    kit.contentPillars.map((pillar) => ({ id: pillar.id, label: pillar.label })),
    Date.now(),
    {
      plan: `/projects/${projectId}/plan`,
      post: (postId) => `/projects/${projectId}/queue?post=${postId}`,
    },
  );
  const posts = model.posts.filter((post) => post.day >= start && post.day <= end);
  const current = accountSpan(sources.days, "instagram", start, end);
  const previous = accountSpan(sources.days, "instagram", shiftDay(start, -7), shiftDay(start, -1));
  const fromPosts = postSpan(posts, start, end);
  const reach = current.reach ?? fromPosts.reach;
  const changed = compareCount("Reach", { current: reach, previous: previous.reach ?? null });
  const reading = model.takeaways.map((item) => `${item.text} ${item.numbers}`).join(" ");
  const markdown = weeklyReportMarkdown({
    weekStart: start,
    weekEnd: end,
    followers: current.followers,
    followsGained: fromPosts.follows,
    reach,
    views: current.views ?? fromPosts.views,
    profileViews: current.profileViews ?? fromPosts.profileViews,
    linkTaps: current.websiteTaps,
    posts,
    whatChanged: changed.text,
    reading: reading || "No takeaway yet.",
    nextSentence: sentence.replace(/[\u2014\u2013]/g, ",").slice(0, 500),
  });
  return { start, end, markdown, file: `exports/reports/${projectId}/${start}.md` };
}

export async function writeWeekReport(projectId: string, week: string, sentence = "") {
  const report = await buildWeekReport(projectId, week, sentence);
  const root = path.resolve(process.cwd(), "exports/reports");
  const dir = path.resolve(root, projectId);
  const file = path.resolve(dir, `${report.start}.md`);
  if (!dir.startsWith(`${root}${path.sep}`) || !file.startsWith(`${dir}${path.sep}`)) throw new Error("Bad path");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, report.markdown);
  return report;
}
