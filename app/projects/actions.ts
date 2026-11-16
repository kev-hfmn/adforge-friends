"use server";

import { db } from "@/lib/db";
import { projects, knowledgeBase } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveUploadedFile } from "@/lib/storage";
import { ensureBrandKit } from "@/lib/brand-kit";
import { normalizeBioLink } from "@/lib/project-rules";

export async function getProjects() {
  return db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
}

export async function getProject(id: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
}

export async function createProject(formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";
  const brandColor = (formData.get("brandColor") as string) || "#6366f1";
  const bioLink = normalizeBioLink(String(formData.get("bioLink") ?? ""));
  const logoFile = formData.get("logo") as File | null;

  let logoPath: string | null = null;
  if (logoFile && logoFile.size > 0) {
    logoPath = await saveUploadedFile(logoFile);
  }

  const id = uuidv4();

  await db.insert(projects).values({
    id,
    name,
    description,
    brandColor,
    bioLink,
    logoPath,
  });

  // Auto-seed knowledge base sections
  const defaultSections = [
    { section: "product_overview", title: "Product Overview", sortOrder: 0 },
    { section: "product_content_info", title: "Product Content & Offers", sortOrder: 1 },
    { section: "brand_voice", title: "Brand Voice", sortOrder: 2 },
    { section: "target_audience", title: "Target Audience", sortOrder: 3 },
    { section: "visual_guidelines", title: "Visual Guidelines", sortOrder: 4 },
    { section: "ig_hooks", title: "IG Hooks", sortOrder: 5 },
    { section: "example_captions", title: "Example Captions", sortOrder: 6 },
  ];

  for (const s of defaultSections) {
    await db.insert(knowledgeBase).values({
      id: uuidv4(),
      projectId: id,
      section: s.section,
      title: s.title,
      content: "",
      sortOrder: s.sortOrder,
      updatedAt: Date.now(),
    });
  }

  // Empty Brand Kit — fill Design / Brand Kit tab per project
  await ensureBrandKit(id);

  revalidatePath("/");
  redirect(`/projects/${id}/setup`);
}

export async function updateProject(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";
  const brandColor = (formData.get("brandColor") as string) || "#6366f1";
  const logoFile = formData.get("logo") as File | null;

  const updates: Record<string, unknown> = {
    name,
    description,
    brandColor,
    updatedAt: Date.now(),
  };

  if (logoFile && logoFile.size > 0) {
    updates.logoPath = await saveUploadedFile(logoFile);
  }

  await db.update(projects).set(updates).where(eq(projects.id, id));
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function deleteProject(id: string) {
  const { projectBrandKits } = await import("@/drizzle/schema");
  await db.delete(projectBrandKits).where(eq(projectBrandKits.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/");
  redirect("/");
}

/** The project's usual posting week (Setup, "Rhythm and automation"). */
export async function saveRhythm(
  id: string,
  slots: { label: string; days: number[]; hour: number; kind?: string }[],
) {
  const clean = slots
    .map((s) => ({
      label: String(s.label ?? "").trim().slice(0, 60),
      days: [...new Set((s.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d < 7))].sort(),
      hour: Number(s.hour),
      ...(typeof s.kind === "string" && /^[a-z-]{1,20}$/.test(s.kind)
        ? { kind: s.kind }
        : {}),
    }))
    .filter((s) => s.label && s.days.length);
  if (clean.some((s) => !Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23))
    throw new Error("Hours run from 0 to 23");
  if (clean.length > 20) throw new Error("Keep the rhythm to 20 rows");
  await db
    .update(projects)
    .set({ rhythmJson: JSON.stringify(clean), updatedAt: Date.now() })
    .where(eq(projects.id, id));
  revalidatePath(`/projects/${id}`, "layout");
}

/** Who may write this project's copy (Setup, Overview). */
export async function saveCopyMode(id: string, formData: FormData) {
  const mode = formData.get("copyMode");
  if (mode !== "claude_session" && mode !== "generator")
    throw new Error("Unknown copy rule");
  await db
    .update(projects)
    .set({ copyMode: mode, updatedAt: Date.now() })
    .where(eq(projects.id, id));
  revalidatePath(`/projects/${id}`, "layout");
}

/** The site a caption's "link in bio" becomes. Blank clears it. */
export async function saveBioLink(id: string, formData: FormData) {
  const bioLink = normalizeBioLink(String(formData.get("bioLink") ?? ""));
  await db
    .update(projects)
    .set({ bioLink, updatedAt: Date.now() })
    .where(eq(projects.id, id));
  revalidatePath(`/projects/${id}`, "layout");
}
