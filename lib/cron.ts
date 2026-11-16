import { db } from "./db";
import { autopilotConfig, generatedPosts, generationLogs, projects, socialChannels } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { generateAdContent } from "./anthropic";
import { v4 as uuidv4 } from "uuid";
import { renderPost } from "@/lib/render";
import { publishPostToInstagram } from "@/lib/publish";
import { crosspostDue } from "@/lib/crosspost";
import { refreshToken } from "@/lib/instagram";
import { runDueScheduled } from "@/lib/queue-schedule";
import { connectionState, facebookConnected, targetChannel } from "@/lib/queue-view";
import { refreshPublishedInsights } from "@/lib/queue-tracking";

export async function runAutopilot(projectId: string) {
  const config = await db.query.autopilotConfig.findFirst({
    where: eq(autopilotConfig.projectId, projectId),
  });

  if (!config || !config.enabled) return;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return;

  // Check if already ran today
  if (config.lastRunAt) {
    const lastRun = new Date(config.lastRunAt);
    const today = new Date();
    if (
      lastRun.getFullYear() === today.getFullYear() &&
      lastRun.getMonth() === today.getMonth() &&
      lastRun.getDate() === today.getDate()
    ) {
      console.log(`Autopilot already ran today for project ${projectId}`);
      return;
    }
  }

  const postsToGenerate = config.postsPerDay || 2;
  const prompt = (config.promptTemplate || "Create an engaging Instagram ad")
    .replace(/\{\{brand_name\}\}/g, project.name)
    .replace(/\{\{target_audience\}\}/g, "our target audience");

  for (let i = 0; i < postsToGenerate; i++) {
    const startTime = Date.now();
    try {
      const variation = `${prompt} (variation ${i + 1} of ${postsToGenerate})`;
      const data = await generateAdContent(projectId, variation, "ad");

      const postId = uuidv4();
      await db.insert(generatedPosts).values({
        id: postId,
        projectId,
        status: "pending",
        templateType: "ad",
        headline: data.headlineStart,
        headlineHighlight: data.headlineHighlight,
        subtext: data.subtext,
        boldPhrases: JSON.stringify(data.boldPhrases),
        caption: data.caption,
        hashtags: data.hashtags,
        backgroundPreset: data.backgroundPreset,
        layoutStyle: 'bold-statement',
        metadata: JSON.stringify({
          stats: data.stats,
          socialProof: data.socialProof,
          ctaText: data.ctaText,
        }),
        source: "autopilot",
      });

      await db.insert(generationLogs).values({
        id: uuidv4(),
        projectId,
        postId,
        type: "autopilot",
        prompt: variation,
        response: JSON.stringify(data),
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
      });

      if (config.autoPostAfterApproval) {
        try {
          await renderPost(postId);
          await publishPostToInstagram(postId, projectId);
        } catch (err) {
          console.error("Auto-post failed:", err);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.insert(generationLogs).values({
        id: uuidv4(),
        projectId,
        type: "autopilot",
        prompt,
        response: JSON.stringify({ error: message }),
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        error: message,
      });
    }
  }

  // Update lastRunAt
  await db
    .update(autopilotConfig)
    .set({ lastRunAt: Date.now(), updatedAt: Date.now() })
    .where(eq(autopilotConfig.id, config.id));
}

export async function refreshExpiringTokens() {
  const tenDays = 10 * 24 * 60 * 60 * 1000;
  const channels = await db.query.socialChannels.findMany({ where: eq(socialChannels.platform, "instagram") });
  for (const ch of channels) {
    if (!ch.accessToken || !ch.tokenExpiresAt) continue;
    const msLeft = ch.tokenExpiresAt - Date.now();
    if (msLeft <= 0 || msLeft > tenDays) continue; // expired tokens can't be refreshed; fresh ones don't need it
    try {
      const refreshed = await refreshToken(ch.accessToken);
      await db.update(socialChannels).set({
        accessToken: refreshed.access_token,
        tokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
      }).where(eq(socialChannels.id, ch.id));
      console.log(`[Cron] Refreshed IG token for channel ${ch.igUsername}`);
    } catch (err) {
      console.error(`[Cron] Token refresh failed for ${ch.igUsername}:`, err);
    }
  }
}

export async function runAllAutopilots() {
  await refreshExpiringTokens();
  // Publishing and stats must never block the daily content engine below.
  try {
    await publishDueScheduled();
  } catch (err) {
    console.error("[Queue] Scheduled publishing failed:", err);
  }
  try {
    await crosspostDue();
  } catch (err) {
    console.error("[Crosspost] Run failed:", err);
  }
  try {
    await refreshPublishedInsights();
  } catch (err) {
    console.error("[Queue] Insights refresh failed:", err);
  }
  const configs = await db.query.autopilotConfig.findMany();
  for (const config of configs) {
    if (config.enabled && config.projectId) {
      await runAutopilot(config.projectId);
    }
  }
}

let scheduledPublishing = false;
export async function publishDueScheduled() {
  if (scheduledPublishing) return;
  scheduledPublishing = true;
  try {
    const posts = await db.query.generatedPosts.findMany({ where: eq(generatedPosts.status, "approved") });
    await runDueScheduled(posts, Date.now(), {
      connected: async post => {
        const platform = targetChannel(post);
        const channel = await db.query.socialChannels.findFirst({ where: (t, { and, eq }) => and(eq(t.projectId, post.projectId!), eq(t.platform, platform)) });
        return platform === "facebook" ? facebookConnected(channel) : connectionState(channel).active;
      },
      publish: async post => {
        // Re-read after earlier posts finish so a declined or rescheduled post stays put.
        const current = await db.query.generatedPosts.findFirst({ where: eq(generatedPosts.id, post.id) });
        if (current?.status !== "approved" || current.scheduledAt == null || current.scheduledAt > Date.now()) return;
        await publishPostToInstagram(post.id, post.projectId!);
      },
      fail: async (post, error) => {
        if (error === "This post is already publishing") return;
        await db.update(generatedPosts).set({ status: "failed", publishError: error }).where(and(eq(generatedPosts.id, post.id), eq(generatedPosts.status, "approved")));
      },
    });
  } finally { scheduledPublishing = false; }
}
