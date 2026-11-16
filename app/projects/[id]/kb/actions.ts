"use server";

import { db } from "@/lib/db";
import { knowledgeBase } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function updateKBSection(id: string, content: string) {
  await db
    .update(knowledgeBase)
    .set({ content, updatedAt: Date.now() })
    .where(eq(knowledgeBase.id, id));
}

export async function updateKBTitle(id: string, title: string) {
  await db
    .update(knowledgeBase)
    .set({ title, updatedAt: Date.now() })
    .where(eq(knowledgeBase.id, id));
}

export async function addKBSection(projectId: string) {
  const existing = await db.query.knowledgeBase.findMany({
    where: eq(knowledgeBase.projectId, projectId),
  });

  await db.insert(knowledgeBase).values({
    id: uuidv4(),
    projectId,
    section: "custom",
    title: "New Section",
    content: "",
    sortOrder: existing.length,
    updatedAt: Date.now(),
  });

  revalidatePath(`/projects/${projectId}/kb`);
}

export async function deleteKBSection(id: string, projectId: string) {
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
  revalidatePath(`/projects/${projectId}/kb`);
}
