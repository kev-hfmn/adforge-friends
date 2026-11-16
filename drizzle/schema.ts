import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  name: text("name").notNull(),
  description: text("description"),
  brandColor: text("brand_color").default("#6366f1"),
  logoPath: text("logo_path"),
  /** JSON: { label, days: number[] (0 = Sunday), hour, kind? }[]. The usual posting week; null = none set. */
  rhythmJson: text("rhythm_json"),
  /** Who may write this project's copy: "claude_session" (no generator) | "generator". null = generator. */
  copyMode: text("copy_mode"),
  /** Site used when a caption says "link in bio". Null leaves those words unchanged. */
  bioLink: text("bio_link"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const projectsRelations = relations(projects, ({ many, one }) => ({
  knowledgeBase: many(knowledgeBase),
  generatedPosts: many(generatedPosts),
  socialChannels: many(socialChannels),
  autopilotConfig: many(autopilotConfig),
  generationLogs: many(generationLogs),
  brandKit: one(projectBrandKits, {
    fields: [projects.id],
    references: [projectBrandKits.projectId],
  }),
}));

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export const knowledgeBase = sqliteTable("knowledge_base", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id").references(() => projects.id),
  section: text("section"), // brand_voice | target_audience | visual_guidelines | ig_hooks | example_captions | custom
  title: text("title").notNull(),
  content: text("content").default(""),
  sortOrder: integer("sort_order").default(0),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  project: one(projects, {
    fields: [knowledgeBase.projectId],
    references: [projects.id],
  }),
}));

// ─── Generated Posts ─────────────────────────────────────────────────────────

export const generatedPosts = sqliteTable("generated_posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id").references(() => projects.id),
  status: text("status").default("draft"), // draft | pending | approved | declined | posted | failed
  templateType: text("template_type").default("ad"), // ad | reel | carousel
  headline: text("headline"),
  headlineHighlight: text("headline_highlight"),
  subtext: text("subtext"),
  boldPhrases: text("bold_phrases"), // JSON array
  caption: text("caption"),
  hashtags: text("hashtags"),
  backgroundPreset: text("background_preset").default("dark-gradient"),
  layoutStyle: text("layout_style").default("bold-statement"),
  metadata: text("metadata"), // JSON
  imagePath: text("image_path"),
  videoPath: text("video_path"),
  backgroundImageUrl: text("background_image_url"),
  carouselSlides: text("carousel_slides"), // JSON: CarouselSlide[]
  targetingContext: text("targeting_context"), // JSON: TargetingContext — nullable, no default
  palette: text("palette"),                    // nullable — palette ID from lib/design-palettes.ts; null = resolve via legacyPresetToPalette
  imageMode: text("image_mode").default("template"),       // template | fal_background | fal_full
  imagePrompt: text("image_prompt"),                       // last-used Nano Banana prompt (for re-runs)
  falSourceUrl: text("fal_source_url"),                    // signed FAL URL (for image-edit iterations)
  source: text("source").default("manual"), // manual | bulk | autopilot
  igMediaId: text("ig_media_id"),
  postedAt: integer("posted_at"),
  scheduledAt: integer("scheduled_at"),
  permalink: text("permalink"),
  publishError: text("publish_error"),
  insightsJson: text("insights_json"),
  insightsUpdatedAt: integer("insights_updated_at"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const generatedPostsRelations = relations(
  generatedPosts,
  ({ one }) => ({
    project: one(projects, {
      fields: [generatedPosts.projectId],
      references: [projects.id],
    }),
  })
);

// ─── Social Channels ─────────────────────────────────────────────────────────

export const socialChannels = sqliteTable("social_channels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id").references(() => projects.id),
  platform: text("platform").default("instagram"),
  accessToken: text("access_token"),
  igUserId: text("ig_user_id"),
  igUsername: text("ig_username"),
  tokenExpiresAt: integer("token_expires_at"),
  // Channels reached through a posting service (TikTok, Facebook via Zernio) have no
  // token here: the service holds it. accountId is the service's account _id.
  provider: text("provider"), // null = direct (Instagram) | "zernio"
  accountId: text("account_id"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const socialChannelsRelations = relations(socialChannels, ({ one }) => ({
  project: one(projects, {
    fields: [socialChannels.projectId],
    references: [projects.id],
  }),
}));

// ─── Autopilot Config ────────────────────────────────────────────────────────

export const autopilotConfig = sqliteTable("autopilot_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .unique(),
  enabled: integer("enabled").default(0),
  cronTime: text("cron_time").default("0 8 * * *"),
  promptTemplate: text("prompt_template"),
  postsPerDay: integer("posts_per_day").default(2),
  autoPostAfterApproval: integer("auto_post_after_approval").default(0),
  lastRunAt: integer("last_run_at"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const autopilotConfigRelations = relations(
  autopilotConfig,
  ({ one }) => ({
    project: one(projects, {
      fields: [autopilotConfig.projectId],
      references: [projects.id],
    }),
  })
);

// ─── Generation Logs ─────────────────────────────────────────────────────────

export const generationLogs = sqliteTable("generation_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id").references(() => projects.id),
  postId: text("post_id").references(() => generatedPosts.id),
  type: text("type"), // manual | bulk | autopilot
  prompt: text("prompt"),
  response: text("response"), // JSON
  tokensUsed: integer("tokens_used"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const generationLogsRelations = relations(generationLogs, ({ one }) => ({
  project: one(projects, {
    fields: [generationLogs.projectId],
    references: [projects.id],
  }),
  post: one(generatedPosts, {
    fields: [generationLogs.postId],
    references: [generatedPosts.id],
  }),
}));

// ─── Project Brand Kits ──────────────────────────────────────────────────────
// Per-project design system + creative rules. Injected into every generation path.
// Free-form Knowledge Base stays for facts/hooks; Brand Kit is the visual + gate layer.

export const projectBrandKits = sqliteTable("project_brand_kits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull()
    .unique(),
  northStar: text("north_star"),
  oneLiner: text("one_liner"),
  antiReferences: text("anti_references"),
  /** JSON: { primary, background, accents?: string[], notes?: string, tokens?: Record<string,string> } */
  colorsJson: text("colors_json"),
  /** JSON: { family, maxWeight, notes } */
  typographyJson: text("typography_json"),
  uiNotes: text("ui_notes"),
  visualDos: text("visual_dos"),
  visualDonts: text("visual_donts"),
  rejectGate: text("reject_gate"),
  /** Appended to every image-gen prompt for this project */
  imageStyleLock: text("image_style_lock"),
  /** Extra suffix when image must not contain text (backgrounds) */
  imageStyleLockNoText: text("image_style_lock_no_text"),
  /** JSON: { id, label, description }[] */
  contentPillarsJson: text("content_pillars_json"),
  /** JSON: { id, ratio, notes }[] */
  formatsJson: text("formats_json"),
  editorialRules: text("editorial_rules"),
  ctaFacts: text("cta_facts"),
  /** JSON string[] of allowed design-palette IDs; empty = no restriction */
  allowedPaletteIds: text("allowed_palette_ids"),
  /** JSON string[] of layout styles to ban for this project */
  bannedLayoutStyles: text("banned_layout_styles"),
  /** Full imported markdown dump (optional archive) */
  fullMarkdown: text("full_markdown"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const projectBrandKitsRelations = relations(projectBrandKits, ({ one }) => ({
  project: one(projects, {
    fields: [projectBrandKits.projectId],
    references: [projects.id],
  }),
}));

// Notes on a queued post. The owner writes "change slide 3" in the post sheet; Claude lists
// the open ones with scripts/feedback.ts at the start of a session and resolves them.
export const postNotes = sqliteTable("post_notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  postId: text("post_id")
    .references(() => generatedPosts.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id").references(() => projects.id),
  author: text("author").default("owner"), // owner | claude
  body: text("body").notNull(),
  slide: integer("slide"), // 1-based slide the note is about; null = the whole post
  reply: text("reply"), // what was changed, written when the note is resolved
  resolvedAt: integer("resolved_at"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  parentId: text("parent_id"),
  /** JSON: { field, from, to, text }. A proposed replacement. Accepting it writes the text. */
  suggestion: text("suggestion"),
});

// Per-channel caption. Null caption or hashtags means "use the main post".
// Crosspost reads a row when one exists. The send is unchanged.
export const postVariants = sqliteTable("post_variants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  postId: text("post_id")
    .references(() => generatedPosts.id, { onDelete: "cascade" })
    .notNull(),
  channel: text("channel").notNull(), // instagram | facebook | tiktok | x
  caption: text("caption"),
  firstComment: text("first_comment"),
  hashtags: text("hashtags"),
  altText: text("alt_text"), // JSON string[] for the post's images, usually on the instagram row
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

// Saved lines and hashtag sets, inserted with / in the caption studio.
export const snippets = sqliteTable("snippets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  label: text("label").notNull(),
  body: text("body").notNull(),
  kind: text("kind").default("line"), // line | hashtags
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

// Reusable media: app screenshots, photos, charts and clips, captured once and tagged
// so later posts (and Claude, via scripts/assets.ts) can find them again.
export const assets = sqliteTable("assets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  path: text("path").notNull(), // public path, /uploads/<projectId>/<file>
  kind: text("kind").default("screenshot"), // screenshot | photo | chart | clip
  feature: text("feature"), // the product feature or topic it shows, e.g. "Onboarding"
  tags: text("tags"), // JSON string[]
  note: text("note"),
  capturedAt: integer("captured_at"), // when it was taken (a day), not when it was uploaded
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

// One row per post per extra channel (TikTok, Facebook). Instagram stays on the post
// itself (igMediaId, permalink). A row is written before the send, so a crash can never
// lead to a second copy going out.
export const postPublications = sqliteTable("post_publications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  postId: text("post_id")
    .references(() => generatedPosts.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id").references(() => projects.id),
  platform: text("platform").notNull(), // tiktok | facebook
  status: text("status").default("publishing"), // publishing | posted | failed
  externalId: text("external_id"), // the service's post id
  url: text("url"),
  error: text("error"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  postedAt: integer("posted_at"),
});

// Structured knowledge. The old knowledge_base rows stay; sync copies them in as notes.
export const kbEntries = sqliteTable("kb_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").default(""),
  fields: text("fields"),
  tags: text("tags"),
  pillar: text("pillar"),
  status: text("status").default("active"),
  source: text("source").notNull(),
  sourceRef: text("source_ref"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
  lastUsedAt: integer("last_used_at"),
  useCount: integer("use_count").default(0),
});

export const kbVersions = sqliteTable("kb_versions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  entryId: text("entry_id")
    .references(() => kbEntries.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title"),
  body: text("body").default(""),
  fields: text("fields"),
  editor: text("editor"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const postKbLinks = sqliteTable("post_kb_links", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  postId: text("post_id")
    .references(() => generatedPosts.id, { onDelete: "cascade" })
    .notNull(),
  entryId: text("entry_id")
    .references(() => kbEntries.id, { onDelete: "cascade" })
    .notNull(),
  how: text("how").notNull(),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const kbSyncWarnings = sqliteTable("kb_sync_warnings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  file: text("file").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

// Events the owner adds to the Plan (launches, holidays). Nothing here publishes.
export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  kind: text("kind"),
  source: text("source"),
  url: text("url"),
  fetchedAt: integer("fetched_at"),
});

// History of a post's insights. insightsJson on the post stays the latest value.
export const postMetricSnapshots = sqliteTable("post_metric_snapshots", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  postId: text("post_id")
    .references(() => generatedPosts.id, { onDelete: "cascade" })
    .notNull(),
  channel: text("channel").notNull(),
  takenAt: integer("taken_at").notNull(),
  metrics: text("metrics").notNull(),
});

// One row per project, channel and local day (QUEUE_TIME_ZONE). Null means the platform did not return that number.
export const accountDaily = sqliteTable("account_daily", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id)
    .notNull(),
  channel: text("channel").notNull(),
  day: text("day").notNull(),
  followers: integer("followers"),
  reach: integer("reach"),
  views: integer("views"),
  profileViews: integer("profile_views"),
  accountsEngaged: integer("accounts_engaged"),
  websiteTaps: integer("website_taps"),
  onlineFollowers: text("online_followers"),
  demographics: text("demographics"),
  updatedAt: integer("updated_at"),
});

// A backlog the owner and Claude share. Turning one into a post makes a draft. Nothing here publishes.
export const ideas = sqliteTable("ideas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  body: text("body"),
  pillar: text("pillar"),
  format: text("format"),
  tags: text("tags"),
  status: text("status").default("inbox").notNull(),
  links: text("links"),
  createdBy: text("created_by").default("owner").notNull(),
  dueWeek: text("due_week"),
  postId: text("post_id").references(() => generatedPosts.id, { onDelete: "set null" }),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

// Who changed what, through the agent interface. Nothing here sends a post.
export const auditLog = sqliteTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  projectId: text("project_id").references(() => projects.id),
  actor: text("actor").notNull(), // owner | claude | cron
  action: text("action").notNull(),
  target: text("target").notNull(),
  beforeSummary: text("before_summary"),
  afterSummary: text("after_summary"),
  quote: text("quote"),
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});
