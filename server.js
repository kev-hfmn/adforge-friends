/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS entry for node */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
// HOST=127.0.0.1 behind a reverse proxy or tunnel, so only the proxy can reach it.
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Initialize cron jobs. ADFORGE_CRON=off runs the app without the hourly job,
  // so a second copy (tests, a staging copy) can never post or publish.
  if (process.env.ADFORGE_CRON === "off") {
    console.log("[Cron] Disabled (ADFORGE_CRON=off)");
  } else try {
    const cron = require("node-cron");

    // Run autopilot every hour, check which projects need generation
    cron.schedule("0 * * * *", async () => {
      console.log("[Cron] Checking autopilot schedules...");
      try {
        const res = await fetch(`http://localhost:${port}/api/cron/generate`, {
          method: "POST",
          headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
        });
        const data = await res.json();
        console.log("[Cron] Autopilot result:", data);
      } catch (err) {
        console.error("[Cron] Autopilot error:", err);
      }
    });

    console.log("[Cron] Autopilot cron initialized");
  } catch (err) {
    console.error("[Cron] Failed to initialize:", err);
  }

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
