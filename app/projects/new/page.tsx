import { AppShell } from "@/components/AppShell";
import { createProject } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  return (
    <AppShell>
      <div className="border-b border-border">
        <div className="flex h-16 items-center gap-4 px-4 md:px-8">
          <Link
            href="/"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">New project</h1>
        </div>
      </div>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Create project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProject} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" name="name" placeholder="My Brand" required />
              </div>
              <p className="text-sm text-muted-foreground">
                Each app is its own project. Its site, channels, rhythm, and hub stay with it.
              </p>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of this project..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bioLink">Site</Label>
                <Input id="bioLink" name="bioLink" placeholder="example.com" />
                <p className="text-sm text-muted-foreground">
                  Captions that say link in bio use this address on TikTok and Facebook.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="brandColor"
                    name="brandColor"
                    type="color"
                    defaultValue="#6366f1"
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground">
                    Used for highlights and accents
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo (optional)</Label>
                <Input id="logo" name="logo" type="file" accept="image/*" />
              </div>
              <div className="flex gap-3">
                <Button type="submit">Create project</Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
