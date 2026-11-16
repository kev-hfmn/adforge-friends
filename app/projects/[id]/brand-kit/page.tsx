import { getProject } from "../../actions";
import { notFound } from "next/navigation";
import { ensureBrandKit, rowToFields } from "@/lib/brand-kit";
import { BrandKitForm } from "@/components/BrandKitForm";

export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const row = await ensureBrandKit(id);
  const fields = rowToFields(row);

  return (
    <BrandKitForm projectId={id} projectName={project.name} initial={fields} />
  );
}
