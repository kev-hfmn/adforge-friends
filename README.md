# AdForge

Plan, write, render and publish social posts for your own projects: Instagram first, then
Facebook and TikTok. You approve every post; an hourly job publishes it at its time.

- **Plan:** a calendar with your weekly rhythm, drag posts to reschedule
- **Posts:** a review queue with an Instagram preview, caption studio and copy checks
- **Ideas:** a backlog that turns into drafts
- **Hub:** your facts, voice and banned phrases; every caption is checked against them
- **Generator:** feed posts, carousels and reels written by Claude in your brand kit
- **Results:** insights per post and a weekly report

Runs locally (Next.js + SQLite). Your data stays in `db.sqlite` on your machine.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in ADFORGE_PASSWORD, CRON_SECRET, ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

**Easiest:** open this folder in Claude Code and say *"Read CLAUDE.md and set this up for me."*
It walks you through the keys, Instagram, and running it for real.

Full setup, the publishing flow and the code map: [CLAUDE.md](CLAUDE.md).
