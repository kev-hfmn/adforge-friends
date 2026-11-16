"use server";

import { db } from "@/lib/db";
import { autopilotConfig } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function saveAutopilotConfig(
  projectId: string,
  data: {
    enabled: boolean;
    cronTime: string;
    promptTemplate: string;
    postsPerDay: number;
    autoPostAfterApproval: boolean;
  }
) {
  const existing = await db.query.autopilotConfig.findFirst({
    where: eq(autopilotConfig.projectId, projectId),
  });

  if (existing) {
    await db
      .update(autopilotConfig)
      .set({
        enabled: data.enabled ? 1 : 0,
        cronTime: data.cronTime,
        promptTemplate: data.promptTemplate,
        postsPerDay: data.postsPerDay,
        autoPostAfterApproval: data.autoPostAfterApproval ? 1 : 0,
        updatedAt: Date.now(),
      })
      .where(eq(autopilotConfig.id, existing.id));
  } else {
    await db.insert(autopilotConfig).values({
      id: uuidv4(),
      projectId,
      enabled: data.enabled ? 1 : 0,
      cronTime: data.cronTime,
      promptTemplate: data.promptTemplate,
      postsPerDay: data.postsPerDay,
      autoPostAfterApproval: data.autoPostAfterApproval ? 1 : 0,
    });
  }

  revalidatePath(`/projects/${projectId}/autopilot`);
}
