"use server";

import { revalidatePath } from "next/cache";
import { parseDay, removeAsset, updateAsset } from "@/lib/assets";

export async function editAsset(id: string, projectId: string, form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  await updateAsset(id, projectId, {
    kind: text("kind"),
    feature: text("feature"),
    tags: text("tags"),
    capturedAt: parseDay(text("capturedOn")),
    note: text("note"),
  });
  revalidatePath(`/projects/${projectId}/library`);
}

export async function deleteAsset(id: string, projectId: string) {
  await removeAsset(id, projectId);
  revalidatePath(`/projects/${projectId}/library`);
}
