import Link from "next/link";
import { notFound } from "next/navigation";
import { IdeaKeys } from "@/components/ideas/IdeaKeys";
import { getProject } from "@/app/projects/actions";
import { createIdeaAction } from "../actions";

export const dynamic = "force-dynamic";

function splitCapture(text: string): { title: string; body: string } {
  const trimmed = text.replace(/\r/g, "").trim();
  if (!trimmed) return { title: "", body: "" };
  const [first, ...rest] = trimmed.split("\n");
  return { title: first.trim().slice(0, 140), body: rest.join("\n").trim() };
}

export default async function NewIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ text?: string; url?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const project = await getProject(id);
  if (!project) notFound();
  const capture = splitCapture(search.text ?? "");
  const field =
    "min-h-11 w-full rounded-lg border border-input bg-field px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <IdeaKeys projectId={id} />
      <header className="space-y-1">
        <h1 className="text-[28px] font-medium tracking-tight">New idea</h1>
        <p className="text-sm text-muted-foreground">It lands in Inbox. It does not become a post until you say so.</p>
      </header>
      <form action={createIdeaAction.bind(null, id)} className="space-y-4">
        <label className="block space-y-1 text-sm">
          Title
          <input name="title" required defaultValue={capture.title} className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          Notes
          <textarea name="body" rows={5} defaultValue={capture.body} className={`${field} min-h-28 py-2`} />
        </label>
        <label className="block space-y-1 text-sm">
          Link
          <input name="url" type="url" defaultValue={search.url ?? ""} placeholder="https://" className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          Pillar
          <input name="pillar" className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          Format
          <select name="format" defaultValue="" className={field}>
            <option value="">Leave blank</option>
            <option value="reel">Reel</option>
            <option value="carousel">Carousel</option>
            <option value="photo">Photo</option>
          </select>
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            Save idea
          </button>
          <Link href={`/projects/${id}/ideas`} className="text-sm underline-offset-2 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
