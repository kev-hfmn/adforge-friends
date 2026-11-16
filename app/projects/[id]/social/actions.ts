"use server";

import { db } from "@/lib/db";
import { socialChannels } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function disconnectInstagram(channelId: string, projectId: string) {
  await db.delete(socialChannels).where(eq(socialChannels.id, channelId));
  revalidatePath(`/projects/${projectId}/social`);
}
