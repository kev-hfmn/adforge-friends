# AdForge

AdForge plans, writes, renders and publishes social media posts for your own projects. You write
(or Claude writes) the posts, you approve them, and an hourly job publishes them to Instagram, then
Facebook and TikTok. Each project has its own brand kit, its own knowledge hub (the facts every
caption is checked against), an ideas board, a weekly rhythm and results.

It runs on your own machine or server: Next.js 16, SQLite, Claude for writing, Takumi for images,
Remotion for reels. There is no cloud account and no shared database. Your data stays in
`db.sqlite` in this folder.

**If you are Claude reading this for the first time:** the person you are working with probably
just cloned this repo and told you to read this file. Work out where they are, using the checklist below, and
take them through it one step at a time. Ask for keys when you need them and explain what each one
is for. Never ask them to paste a key into the chat: they put it into `.env.local` themselves.

---

## First-time setup (Claude: take the user through this)

1. **Node 20.9 or newer.** Check with `node -v`. On a Mac without Node: `brew install node`.
2. **Install:** `npm install`
3. **Environment file:** `cp .env.example .env.local`. Then have the user open `.env.local` in their
   editor and fill in at least:
   - `ADFORGE_PASSWORD`: any password; it protects every page.
   - `CRON_SECRET`: any long random string (`openssl rand -hex 24` makes one).
   - `ANTHROPIC_API_KEY`: from https://console.anthropic.com (the generator needs it).
   - `NEXT_PUBLIC_TIME_ZONE`: their zone, e.g. `Europe/Berlin`, `America/New_York`.
   Do not read or print `.env.local` yourself. To check a key exists without showing it:
   `grep -c '^ANTHROPIC_API_KEY=.\+' .env.local`
4. **Run it:** `npm run dev`, then open http://localhost:3000 and sign in with the password.
   `npm run dev` creates and migrates `db.sqlite` itself (the `predev` hook runs
   `scripts/migrate-db.ts`).
5. **First project:** Projects → New project. The project opens on **Setup**, a checklist:
   connect Instagram, set the site, set the weekly rhythm, write the brand kit, fill the hub,
   queue the first post. Do these in order.

That is enough to write and render posts. **Publishing** needs the next section.

### Connecting Instagram (for publishing)

Instagram downloads each image or video from your app, so the app must be reachable on a public
https address:

1. Give the app a public URL. The quickest: `ngrok http 3000` or
   `cloudflared tunnel --url http://localhost:3000`. Put that URL in `BASE_URL`.
2. In https://developers.facebook.com create an app → add **Instagram** → "API setup with
   Instagram login". Put its Instagram app ID and secret in `META_APP_ID` / `META_APP_SECRET`.
3. Add the redirect URL `<BASE_URL>/api/auth/instagram/callback` in the Meta app, and put the same
   string in `INSTAGRAM_REDIRECT_URI`.
4. The Instagram account must be a **Professional** (Business or Creator) account. While the Meta app is
   in development mode, add the account as a tester in the app's roles.
5. Restart `npm run dev`, then in AdForge: Setup → Channels → Connect Instagram.

Facebook Page and TikTok (through Zernio) are optional; see the comments in `.env.example`. Both
only ever send a post *after* it is live on Instagram (`lib/crosspost.ts`), except posts marked
Facebook only.

### Running it for real (publishing on a schedule)

The hourly job lives in `server.js` (node-cron), **not** in `npm run dev`. To publish approved
posts on time, the production server has to be running:

```bash
npm run build
npm start          # node server.js, migrates first, runs the hourly job
```

Keep it alive with PM2 (`pm2 start ecosystem.config.js`) or a systemd unit, on a machine that
stays on. Put it behind a tunnel or reverse proxy for `BASE_URL`, and set `HOST=127.0.0.1` so
only the proxy reaches it. Times use the server clock for the autopilot's daily hour, so set the
server's time zone to match `NEXT_PUBLIC_TIME_ZONE`.

---

## How a post moves

```
idea ─▶ draft ─▶ in review (pending) ─▶ approved + time ─▶ posted on Instagram ─▶ Facebook / TikTok
                       ▲    │
                       └────┘  "Request changes" note: back to review until resolved
```

- **Nothing publishes without approval.** Approving needs a **future time**. An approved post
  with no time never goes out.
- The hourly job (`publishDueScheduled` in `lib/cron.ts`) publishes approved posts whose time
  has come. A failed post shows as Failed with the reason; retry from the post sheet.
- **Copy checks** run on every save and approval (`lib/studio-check.ts`). They block:
  numbers that are not in the project's Hub facts, em or en dashes, banned phrases from the Hub,
  more than 5 hashtags, captions over a channel's limit, and photos or carousels without alt text.
  Warnings (long sentences, voice rules, first 125 characters) can be overridden.
- **Autopilot** (Setup → Rhythm and automation) drafts new posts daily with the generator. It
  only publishes by itself if "Auto-post after approval" is on; otherwise drafts wait in review.
- **Who writes the copy** (Setup): "The built-in generator may draft posts too" (the default), or
  "Claude, in a session" which hides the generator for that project; then copy is written in a
  Claude Code session using the MCP tools below.

## The app, tab by tab

| Tab | What it is | Main code |
|---|---|---|
| Home | What needs you today | `app/projects/[id]/home` |
| Plan | Week / month / day calendar, drag to reschedule, open rhythm slots | `components/plan/`, `lib/plan.ts` |
| Posts | The queue: review, scheduled, posted, declined; the post sheet | `components/queue/`, `lib/queue-*.ts` |
| Ideas | Backlog board; "Turn into post" makes a draft | `lib/ideas*.ts` |
| Hub | Facts, voice rules, banned phrases, hooks, examples. Captions are checked against it | `lib/kb*.ts` |
| Results | Instagram insights per post, takeaways, weekly report | `lib/results*.ts` |
| Library | Reusable screenshots, photos, clips | `lib/assets.ts` |
| Setup | Checklist, channels, rhythm, brand kit, generator, activity log | `app/projects/[id]/setup` |

The generator (`/projects/[id]/generate`, `components/GeneratorForm.tsx`) makes feed posts (4:5),
reels (9:16) and carousels. One prompt path for every format: `generateProjectPost` in
`lib/anthropic.ts`, fed by the brand kit and the hub (`buildKBContext`).

## Code map

| Area | Files |
|---|---|
| Database schema | `drizzle/schema.ts`, migrations in `drizzle/migrations/`, connection `lib/db.ts` |
| Claude prompts | `lib/anthropic.ts` (generator), `lib/studio-rewrite.ts` (caption rewrites) |
| Image rendering | `lib/render.ts`, templates `components/templates/AdTemplateTakumi.tsx`, `ReelTemplateTakumi.tsx`, palettes `lib/design-palettes.ts` |
| Video (reels) | `lib/render-video.ts`, `src/remotion/` |
| AI images | `lib/fal.ts` (`generateBrandFal` applies the brand kit's image style lock) |
| Publishing | `lib/publish.ts`, `lib/instagram.ts`, `lib/facebook.ts`, `lib/zernio.ts`, `lib/crosspost*.ts` |
| Scheduling | `lib/queue-schedule.ts` (time zone, rhythm), `lib/queue-rules.ts`, `lib/cron.ts`, `server.js` |
| Copy checks | `lib/studio-check.ts`, `lib/queue-copy.ts`, `lib/studio-sources.ts` |
| Login | `proxy.ts` (every page but `/login` needs the password), `lib/auth.ts` |
| Agent API / MCP | `lib/api/` (handlers + `catalog.ts`), `mcp/adforge-server.ts` |

## Working on the code

```bash
npm run dev          # http://localhost:3000 (no hourly job in dev)
npm run typecheck
npm test             # vitest, tests/
npm run lint
npm run build
```

After any change: `npm run typecheck && npm test`. Before calling UI work done, run the app and
look at the page.

**Changing the database:** edit `drizzle/schema.ts`, then `npm run db:generate` (writes a new
migration in `drizzle/migrations/`), then `npm run db:setup` to apply it. Migrations must only add:
never drop or rename a column that holds the user's data.

**Stack gotchas** (these have bitten before):
- shadcn/ui v4 here is built on **@base-ui/react, not Radix**: no `asChild` on triggers;
  `Select.onValueChange` gives `string | null`; `Slider.onValueChange` gives `number | readonly number[]`.
- TipTap needs `immediatelyRender: false` in `useEditor()`.
- **Takumi/Satori image rules:** every container needs `display: "flex"`; no
  `WebkitBackgroundClip: text`; wrap text with `flexDirection: "row", flexWrap: "wrap"` on the
  parent, never `display: flex` on spans; give the root explicit top and bottom padding, and every text
  block a `maxHeight` with `overflow: "hidden"`. Local images must be inlined
  (`toAbsoluteUrl` in `lib/render.ts`).
- Canvas sizes: feed and carousel 1080×1350 (`FEED_W`/`FEED_H`), reel 1080×1920.
- Remotion renders need Chrome on the machine. On a server without it set `VIDEO_RENDER=off`
  and render with `npx tsx scripts/render-video-one.ts <postId>` elsewhere.

## Command-line tools

Scripts read `.env.local` like this (from the repo root):

```bash
set -a && . ./.env.local && set +a && npx tsx scripts/queue.ts list
```

| Script | Does |
|---|---|
| `scripts/queue.ts` | list, propose a time, approve, approve-week, back to review, decline. Never publishes |
| `scripts/feedback.ts` | list and resolve "Request changes" notes |
| `scripts/assets.ts` | search and add Library assets |
| `scripts/publish-now.ts <postId>` | **publishes immediately**. Only when the user says so |
| `scripts/crosspost.ts send <postId>` | **publishes** an older post to TikTok/Facebook. Only when the user says so |
| `scripts/kb-export.ts --project <id>` | writes hub entries to `exports/hub/` |
| `scripts/tts-narration.ts` | ElevenLabs voice-over with word timings for reels |
| `scripts/migrate-db.ts` | apply migrations (`npm run db:setup`) |

## The MCP server (Claude Code talks to the app)

`mcp/adforge-server.ts` gives Claude tools to read the plan, queue, hub and results, and to
write ideas, drafts, captions, proposed times and notes. It has **no publish tool and no delete
tool**, and it cannot read tokens or `.env.local`. Add it from this folder:

```bash
claude mcp add --transport stdio adforge -- npx tsx mcp/adforge-server.ts
```

Tools: `projects_list`, `plan_get`, `queue_list`, `post_get`, `notes_list_open`, `kb_search`,
`kb_context_for`, `copy_check`, `post_create_draft`, `post_update_copy`, `post_propose_time`,
`idea_create`, `report_week`, `approve_week` and more (see `lib/api/catalog.ts`).
`approve_week` needs `ownerSaid`: the user's own words approving that week, stored on the
activity log.

A good writing session: `projects_list` → `notes_list_open` (fix change requests first) →
`plan_get` (find open slots) → `kb_context_for` the topic → write → `copy_check` →
`post_create_draft` → `post_propose_time` → show the user the week → `approve_week` only after
they said yes.

## Rules for Claude in this repo

- **Never publish, approve, or send anything without the user's explicit OK** for that action.
  That includes `publish-now.ts`, `crosspost.ts`, the Approve button and `approve_week`.
- **Never read, print or commit secrets**: `.env.local`, tokens in the `social_channels` table.
  The user puts keys in `.env.local` themselves.
- **`db.sqlite` is the user's data.** Never delete or overwrite it. Before risky work, copy it:
  `cp db.sqlite db.sqlite.bak-$(date +%Y%m%d)` (git-ignored).
- Facts in captions come from the project's Hub. Do not invent numbers, quotes or results; the copy
  check blocks unsourced numbers for a reason.
- No em or en dashes in captions or on-image text (the copy check blocks them).
- Commit only when the user asks. Never push to someone else's branch.
