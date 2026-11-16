import { getProject } from "@/app/projects/actions";
import { notFound } from "next/navigation";
import { GeneratorForm } from "@/components/GeneratorForm";
import { db } from "@/lib/db";
import { generatedPosts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { getBrandKitFields } from "@/lib/brand-kit";

export default async function GeneratePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ postId?: string }>;
}) {
  const { id } = await params;
  const { postId } = await searchParams;

  const project = await getProject(id);
  if (!project) notFound();

  let editPost: typeof generatedPosts.$inferSelect | null = null;
  if (postId) {
    editPost = await db.query.generatedPosts.findFirst({
      where: eq(generatedPosts.id, postId),
    }) ?? null;
  }

  // Brand Kit drives topic chips + palette restrictions on all three formats
  const kit = await getBrandKitFields(id);
  const topicChips = kit.contentPillars.map((p) => ({
    label: p.label,
    value: p.description ? `${p.label}: ${p.description}` : p.label,
  }));

  return (
    <GeneratorForm
      projectId={id}
      brandColor={project.brandColor || "#6366f1"}
      editPost={editPost}
      topicChips={topicChips}
      allowedPaletteIds={kit.allowedPaletteIds}
    />
  );
}
