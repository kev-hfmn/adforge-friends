"use server";

import { generateAdContent } from "@/lib/anthropic";
import { db } from "@/lib/db";
import { generatedPosts, generationLogs } from "@/drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function bulkGenerate(
  projectId: string,
  basePrompt: string,
  templateType: "ad" | "reel",
  count: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  let generated = 0;

  for (let i = 0; i < count; i++) {
    const startTime = Date.now();
    const variation = `${basePrompt}\n\nThis is variation ${i + 1} of ${count}. Make each one unique with different angles, hooks, and stats. Be creative with different value propositions.`;

    try {
      const data = await generateAdContent(projectId, variation, templateType);

      const postId = uuidv4();
      await db.insert(generatedPosts).values({
        id: postId,
        projectId,
        status: "pending",
        templateType,
        headline: data.headlineStart,
        headlineHighlight: data.headlineHighlight,
        subtext: data.subtext,
        boldPhrases: JSON.stringify(data.boldPhrases),
        caption: data.caption,
        hashtags: data.hashtags,
        backgroundPreset: data.backgroundPreset,
        metadata: JSON.stringify({
          stats: data.stats,
          socialProof: data.socialProof,
          ctaText: data.ctaText,
        }),
        source: "bulk",
      });

      await db.insert(generationLogs).values({
        id: uuidv4(),
        projectId,
        postId,
        type: "bulk",
        prompt: variation,
        response: JSON.stringify(data),
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
      });

      generated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.insert(generationLogs).values({
        id: uuidv4(),
        projectId,
        type: "bulk",
        prompt: variation,
        response: JSON.stringify({ error: message }),
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        error: message,
      });
    }
  }

  revalidatePath(`/projects/${projectId}/queue`);
  return { success: generated > 0, count: generated };
}
