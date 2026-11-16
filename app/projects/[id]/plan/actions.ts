"use server";

import { revalidatePath } from "next/cache";
import { addManualEvent } from "@/lib/plan-events";

/** The owner adds a date to the plan. It does not create or publish a post. */
export async function addPlanEvent(projectId: string, date: string, title: string) {
  await addManualEvent(projectId, date, title);
  revalidatePath(`/projects/${projectId}`, "layout");
}
