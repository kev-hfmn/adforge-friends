// Tool names and descriptions for the agent interface.
// The MCP server registers this list and nothing else.
// Keep these words out of every name and description: publish, delete, token, secret, password.
import { z } from "zod";

const projectId = z.string().min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const toolCatalog = [
  {
    name: "projects_list",
    description: "List projects by id, name, and site. Channel credentials are not included.",
    input: z.object({}),
  },
  {
    name: "plan_get",
    description: "Read the plan for a date range: posts, open rhythm slots, and stored events.",
    input: z.object({
      projectId,
      start: day.optional(),
      view: z.enum(["day", "week", "month", "list"]).optional(),
    }),
  },
  {
    name: "post_get",
    description: "Read one post, its channel captions, notes, and studio checks.",
    input: z.object({ projectId, postId: z.string().min(1) }),
  },
  {
    name: "queue_list",
    description: "List posts in one lane: review, scheduled, no-time, failed, or posted.",
    input: z.object({
      projectId,
      lane: z.enum(["review", "scheduled", "no-time", "failed", "posted"]).optional(),
    }),
  },
  {
    name: "notes_list_open",
    description: "List open notes for a project or a post.",
    input: z.object({
      projectId: projectId.optional(),
      postId: z.string().min(1).optional(),
    }),
  },
  {
    name: "kb_search",
    description: "Search the hub by words. Returns active entries for this project.",
    input: z.object({
      projectId,
      query: z.string().min(1),
      types: z.array(z.string()).optional(),
    }),
  },
  {
    name: "kb_context_for",
    description: "Gather hub rules, facts, and examples for a topic before writing.",
    input: z.object({
      projectId,
      topic: z.string().optional(),
      format: z.string().optional(),
      pillar: z.string().optional(),
    }),
  },
  {
    name: "kb_get",
    description: "Read one hub entry, its earlier versions, and the posts that used it.",
    input: z.object({ projectId, entryId: z.string().min(1) }),
  },
  {
    name: "results_overview",
    description: "Read stored results since last week. This does not call Instagram, Facebook, or TikTok.",
    input: z.object({ projectId }),
  },
  {
    name: "results_posts",
    description: "List measured posts from stored results, with a sort.",
    input: z.object({
      projectId,
      sort: z.enum(["date", "reach", "sends", "saves"]).optional(),
    }),
  },
  {
    name: "results_takeaways",
    description: "Read the rule-based takeaways from stored results.",
    input: z.object({ projectId }),
  },
  {
    name: "report_week",
    description: "Build the weekly report from stored numbers. This does not write a file.",
    input: z.object({ projectId, week: day.optional() }),
  },
  {
    name: "assets_search",
    description: "Search the library by feature, tag, kind, or words.",
    input: z.object({
      projectId,
      query: z.string().optional(),
      kind: z.string().optional(),
      tag: z.string().optional(),
      feature: z.string().optional(),
    }),
  },
  {
    name: "ideas_list",
    description: "List ideas for a project, optionally by status.",
    input: z.object({ projectId, status: z.string().optional() }),
  },
  {
    name: "copy_check",
    description: "Run the studio checks on a caption and return blocks and warnings.",
    input: z.object({
      projectId,
      text: z.string(),
      channel: z.enum(["instagram", "facebook", "tiktok", "x"]).optional(),
      postId: z.string().min(1).optional(),
      hashtags: z.string().optional(),
    }),
  },
  {
    name: "idea_create",
    description: "Add an idea. It does not create a post.",
    input: z.object({
      projectId,
      title: z.string().min(1),
      body: z.string().optional(),
      pillar: z.string().optional(),
      format: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.string().optional(),
      dueWeek: day.optional(),
    }),
  },
  {
    name: "idea_update",
    description: "Update an idea title, notes, status, or links.",
    input: z.object({
      projectId,
      ideaId: z.string().min(1),
      title: z.string().optional(),
      body: z.string().optional(),
      pillar: z.string().nullable().optional(),
      format: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      status: z.string().optional(),
      dueWeek: day.nullable().optional(),
    }),
  },
  {
    name: "post_create_draft",
    description: "Create a draft post from a spec. It has no time and is not approved.",
    input: z.object({
      projectId,
      spec: z.object({
        topic: z.string().optional(),
        label: z.string().optional(),
        facts: z.string().optional(),
        caption: z.union([z.string(), z.array(z.string())]).optional(),
        hashtags: z.string().optional(),
        alt: z.string().optional(),
        channel: z.enum(["instagram", "facebook"]).optional(),
        templateType: z.enum(["ad", "reel", "carousel"]).optional(),
        slides: z
          .array(z.object({ text: z.string() }).passthrough())
          .optional(),
      }),
    }),
  },
  {
    name: "post_update_copy",
    description:
      "Save caption and hashtags after the studio checks. A blocked caption is refused unless it is saved as a draft, and it is never kept as approved copy.",
    input: z.object({
      projectId,
      postId: z.string().min(1),
      caption: z.string(),
      hashtags: z.string().optional(),
      asDraft: z.boolean().optional(),
    }),
  },
  {
    name: "post_set_variant",
    description: "Set the caption for one channel. A blocked caption is refused unless it is saved as a draft.",
    input: z.object({
      projectId,
      postId: z.string().min(1),
      channel: z.enum(["instagram", "facebook", "tiktok", "x"]),
      caption: z.string().nullable().optional(),
      hashtags: z.string().nullable().optional(),
      firstComment: z.string().optional(),
      asDraft: z.boolean().optional(),
    }),
  },
  {
    name: "post_propose_time",
    description:
      "Propose a future time. A draft moves to review. An approved post keeps its approval and only the time changes. A missing or passed time is refused.",
    input: z.object({
      projectId,
      postId: z.string().min(1),
      time: z.string().min(1),
    }),
  },
  {
    name: "note_add",
    description: "Add a note on a post. A note from the owner sends the post back to review.",
    input: z.object({
      projectId,
      postId: z.string().min(1),
      body: z.string().min(1),
      slide: z.number().int().optional(),
    }),
  },
  {
    name: "note_resolve",
    description: "Resolve a note and record what changed.",
    input: z.object({
      projectId,
      noteId: z.string().min(1),
      reply: z.string().optional(),
    }),
  },
  {
    name: "suggestion_add",
    description: "Add a suggested rewrite. It does not change the caption until someone accepts it.",
    input: z.object({
      projectId,
      postId: z.string().min(1),
      body: z.string().min(1),
      text: z.string().min(1),
      field: z.enum(["caption", "hashtags", "firstComment"]).optional(),
    }),
  },
  {
    name: "kb_add_entry",
    description: "Add a hub entry for this project.",
    input: z.object({
      projectId,
      type: z.string().min(1),
      title: z.string().min(1),
      body: z.string().optional(),
      tags: z.array(z.string()).optional(),
      pillar: z.string().nullable().optional(),
    }),
  },
  {
    name: "kb_update_entry",
    description: "Update a hub entry. Synced rows are refused.",
    input: z.object({
      projectId,
      entryId: z.string().min(1),
      title: z.string().min(1),
      body: z.string().optional(),
      tags: z.array(z.string()).optional(),
      pillar: z.string().nullable().optional(),
    }),
  },
  {
    name: "taste_confirm",
    description: "Confirm a taste draft so it becomes active. Synced rows are refused.",
    input: z.object({ projectId, entryId: z.string().min(1) }),
  },
  {
    name: "report_save",
    description: "Write the weekly report markdown into the reports folder.",
    input: z.object({
      projectId,
      week: day,
      sentence: z.string().optional(),
    }),
  },
  {
    name: "asset_tag",
    description: "Set the tags on a library asset.",
    input: z.object({
      projectId,
      assetId: z.string().min(1),
      tags: z.union([z.string(), z.array(z.string())]),
    }),
  },
  {
    name: "approve_week",
    description:
      "Mark one week's in-review posts approved after the owner has said OK for that week. weekStart is the Monday (YYYY-MM-DD, in the queue time zone). Only posts with a time inside that Monday to Sunday are approved; posts in other weeks are listed as skipped and left in review. Requires ownerSaid, which is stored on the activity row. Keeps the time rules: a missing or passed time is refused, and an open note blocks approval.",
    input: z.object({
      projectId,
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ownerSaid: z.string(),
    }),
  },
] as const;

export const toolNames = toolCatalog.map((tool) => tool.name);

const banned = ["publish", "delete", "token", "secret", "password"];

export function toolWordHits(): { name: string; word: string }[] {
  const hits: { name: string; word: string }[] = [];
  for (const tool of toolCatalog) {
    const hay = `${tool.name} ${tool.description}`.toLowerCase();
    for (const word of banned) {
      if (hay.includes(word)) hits.push({ name: tool.name, word });
    }
  }
  return hits;
}
