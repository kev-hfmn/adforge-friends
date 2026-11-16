"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  saveBrandKitAction,
  importBrandKitMarkdownAction,
} from "@/app/projects/[id]/brand-kit/actions";
import type { BrandKitFields } from "@/lib/brand-kit";
import { toast } from "sonner";
import { Loader2, Save, Upload } from "lucide-react";


export function BrandKitForm({
  projectId,
  projectName,
  initial,
}: {
  projectId: string;
  projectName: string;
  initial: BrandKitFields;
}) {
  const [fields, setFields] = useState(initial);
  const [importMd, setImportMd] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof BrandKitFields>(key: K, value: BrandKitFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveBrandKitAction(projectId, fd);
      if (res.success) toast.success("Brand Kit saved — generators will use it next run");
      else toast.error(res.error);
    });
  }

  function handleImport() {
    if (!importMd.trim()) {
      toast.error("Paste markdown first");
      return;
    }
    startTransition(async () => {
      const res = await importBrandKitMarkdownAction(projectId, importMd);
      if (res.success) {
        toast.success("Imported from markdown — review fields and Save if needed");
        window.location.reload();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Brand Kit</h2>
          <p className="text-sm text-muted-foreground">
            Design system + creative gates for <strong>{projectName}</strong>. Injected into every AI generation and image style lock.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
            <Upload className="mr-2 h-4 w-4" />
            Import MD
          </Button>
        </div>
      </div>

      {showImport && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Import from markdown</CardTitle>
            <CardDescription>
              Paste a DESIGN.md or brand CLAUDE.md. We extract sections best-effort; full text is archived on the kit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={importMd}
              onChange={(e) => setImportMd(e.target.value)}
              rows={10}
              placeholder="# Design System..."
              className="font-mono text-xs"
            />
            <Button type="button" onClick={handleImport} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Parse & save import
            </Button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oneLiner">One-liner</Label>
              <Input
                id="oneLiner"
                name="oneLiner"
                value={fields.oneLiner}
                onChange={(e) => set("oneLiner", e.target.value)}
                placeholder="Bread worth getting up for..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="northStar">Creative north star</Label>
              <Textarea
                id="northStar"
                name="northStar"
                value={fields.northStar}
                onChange={(e) => set("northStar", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="antiReferences">Anti-references</Label>
              <Textarea
                id="antiReferences"
                name="antiReferences"
                value={fields.antiReferences}
                onChange={(e) => set("antiReferences", e.target.value)}
                rows={4}
                placeholder="- Generic stock photos&#10;- Neon gradients"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Colors & type</CardTitle>
            <CardDescription>Primary accent + deep background drive UI previews and prompt locks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <Label htmlFor="colorPrimary">Primary accent</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="colorPrimary"
                    name="colorPrimary"
                    type="color"
                    value={fields.colors.primary || "#6366f1"}
                    onChange={(e) =>
                      set("colors", { ...fields.colors, primary: e.target.value })
                    }
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={fields.colors.primary || ""}
                    onChange={(e) =>
                      set("colors", { ...fields.colors, primary: e.target.value })
                    }
                    className="w-28 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="colorBackground">Background</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="colorBackground"
                    name="colorBackground"
                    type="color"
                    value={fields.colors.background || "#0a0a12"}
                    onChange={(e) =>
                      set("colors", { ...fields.colors, background: e.target.value })
                    }
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={fields.colors.background || ""}
                    onChange={(e) =>
                      set("colors", { ...fields.colors, background: e.target.value })
                    }
                    className="w-28 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="colorNotes">Color notes / rules</Label>
              <Textarea
                id="colorNotes"
                value={fields.colors.notes || ""}
                onChange={(e) => set("colors", { ...fields.colors, notes: e.target.value })}
                rows={2}
              />
            </div>
            <input type="hidden" name="colorsJson" value={JSON.stringify(fields.colors)} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="typeFamily">Type family</Label>
                <Input
                  id="typeFamily"
                  name="typeFamily"
                  value={fields.typography.family || ""}
                  onChange={(e) =>
                    set("typography", { ...fields.typography, family: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="typeMaxWeight">Max weight</Label>
                <Input
                  id="typeMaxWeight"
                  name="typeMaxWeight"
                  type="number"
                  value={fields.typography.maxWeight ?? 600}
                  onChange={(e) =>
                    set("typography", {
                      ...fields.typography,
                      maxWeight: Number(e.target.value) || 600,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeNotes">Typography notes</Label>
              <Textarea
                id="typeNotes"
                name="typeNotes"
                value={fields.typography.notes || ""}
                onChange={(e) =>
                  set("typography", { ...fields.typography, notes: e.target.value })
                }
                rows={2}
              />
            </div>
            <input type="hidden" name="typographyJson" value={JSON.stringify(fields.typography)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Visual rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uiNotes">UI language</Label>
              <Textarea
                id="uiNotes"
                name="uiNotes"
                value={fields.uiNotes}
                onChange={(e) => set("uiNotes", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visualDos">Do</Label>
              <Textarea
                id="visualDos"
                name="visualDos"
                value={fields.visualDos}
                onChange={(e) => set("visualDos", e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visualDonts">Don&apos;t</Label>
              <Textarea
                id="visualDonts"
                name="visualDonts"
                value={fields.visualDonts}
                onChange={(e) => set("visualDonts", e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectGate">Reject gate</Label>
              <Textarea
                id="rejectGate"
                name="rejectGate"
                value={fields.rejectGate}
                onChange={(e) => set("rejectGate", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Image style lock</CardTitle>
            <CardDescription>
              Appended server-side to every FAL / image generation prompt for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imageStyleLock">Style lock</Label>
              <Textarea
                id="imageStyleLock"
                name="imageStyleLock"
                value={fields.imageStyleLock}
                onChange={(e) => set("imageStyleLock", e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageStyleLockNoText">No-text suffix (backgrounds)</Label>
              <Input
                id="imageStyleLockNoText"
                name="imageStyleLockNoText"
                value={fields.imageStyleLockNoText}
                onChange={(e) => set("imageStyleLockNoText", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="allowedPaletteIds">Allowed palette IDs</Label>
                <Input
                  id="allowedPaletteIds"
                  name="allowedPaletteIds"
                  value={fields.allowedPaletteIds.join(", ")}
                  onChange={(e) =>
                    set(
                      "allowedPaletteIds",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="midnight, clean-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bannedLayoutStyles">Banned layouts</Label>
                <Input
                  id="bannedLayoutStyles"
                  name="bannedLayoutStyles"
                  value={fields.bannedLayoutStyles.join(", ")}
                  onChange={(e) =>
                    set(
                      "bannedLayoutStyles",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="split-panel, data-card"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Editorial & product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editorialRules">Editorial hard rules</Label>
              <Textarea
                id="editorialRules"
                name="editorialRules"
                value={fields.editorialRules}
                onChange={(e) => set("editorialRules", e.target.value)}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaFacts">CTA & product facts</Label>
              <Textarea
                id="ctaFacts"
                name="ctaFacts"
                value={fields.ctaFacts}
                onChange={(e) => set("ctaFacts", e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentPillarsJson">Content pillars (JSON)</Label>
              <Textarea
                id="contentPillarsJson"
                name="contentPillarsJson"
                value={JSON.stringify(fields.contentPillars, null, 2)}
                onChange={(e) => {
                  try {
                    set("contentPillars", JSON.parse(e.target.value));
                  } catch {
                    /* allow invalid while typing */
                  }
                }}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formatsJson">Formats (JSON)</Label>
              <Textarea
                id="formatsJson"
                name="formatsJson"
                value={JSON.stringify(fields.formats, null, 2)}
                onChange={(e) => {
                  try {
                    set("formats", JSON.parse(e.target.value));
                  } catch {
                    /* allow invalid while typing */
                  }
                }}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
            <input type="hidden" name="fullMarkdown" value={fields.fullMarkdown} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button type="submit" disabled={pending} size="lg">
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Brand Kit
          </Button>
        </div>
      </form>
    </div>
  );
}
