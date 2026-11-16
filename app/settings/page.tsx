import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const envVars = [
    {
      key: "ANTHROPIC_API_KEY",
      label: "Anthropic API Key",
      desc: "Required for AI content generation",
      secret: true,
    },
    {
      key: "META_APP_ID",
      label: "Meta App ID",
      desc: "Required for Instagram OAuth",
      secret: false,
    },
    {
      key: "META_APP_SECRET",
      label: "Meta App Secret",
      desc: "Required for Instagram OAuth",
      secret: true,
    },
    {
      key: "INSTAGRAM_REDIRECT_URI",
      label: "Instagram Redirect URI",
      desc: "OAuth callback URL",
      secret: false,
    },
    {
      key: "CRON_SECRET",
      label: "Cron Secret",
      desc: "Secures the autopilot cron endpoint",
      secret: true,
    },
    {
      key: "BASE_URL",
      label: "Base URL",
      desc: "Your deployment URL",
      secret: false,
    },
  ];

  return (
    <AppShell>
      <div className="border-b border-border">
        <div className="flex h-16 items-center px-4 md:px-8">
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        </div>
      </div>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl space-y-8">
        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Environment variables
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure these in your{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                .env.local
              </code>{" "}
              file. Restart the server after changes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {envVars.map((v) => {
              const isSet = !!process.env[v.key];
              return (
                <div
                  key={v.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-0"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all text-sm font-mono">
                        {v.key}
                      </code>
                      {v.secret && (
                        <Badge variant="outline" className="text-xs">
                          secret
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-transparent text-muted-foreground"
                  >
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    {isSet ? "Set" : "Missing"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Separator />

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>App</span>
              <span className="text-foreground font-medium">AdForge</span>
            </div>
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="text-foreground font-medium">
                Next.js 16 (App Router)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Database</span>
              <span className="text-foreground font-medium">
                SQLite + Drizzle ORM
              </span>
            </div>
            <div className="flex justify-between">
              <span>AI Model</span>
              <span className="text-foreground font-medium">
                Claude (Anthropic)
              </span>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Deployment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Deployment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Commands to build and run in production.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Build", cmd: "npm run build" },
              { label: "Start (direct)", cmd: "node server.js" },
              { label: "Start (PM2)", cmd: "pm2 start ecosystem.config.js" },
              { label: "DB migrate", cmd: "npm run db:migrate" },
              { label: "DB studio", cmd: "npm run db:studio" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {item.label}
                </Label>
                <Input
                  readOnly
                  value={item.cmd}
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
