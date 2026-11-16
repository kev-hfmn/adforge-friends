import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/drizzle/schema";
import { addAsset, listAssets, parseDay } from "@/lib/assets";

// The asset library over HTTP (behind the AdForge password, like every /api route).
// GET  /api/assets?projectId=…&kind=…&tag=…&feature=…   list
// POST /api/assets  (multipart: file, projectId, kind, feature, tags, capturedOn, note)   add one file
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const projectId = q.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  return NextResponse.json({
    assets: await listAssets(projectId, {
      kind: q.get("kind") ?? undefined,
      tag: q.get("tag") ?? undefined,
      feature: q.get("feature") ?? undefined,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const projectId = form.get("projectId");
    if (!(file instanceof File) || typeof projectId !== "string")
      return NextResponse.json(
        { error: "file and projectId required" },
        { status: 400 },
      );
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project)
      return NextResponse.json({ error: "Unknown project" }, { status: 404 });
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" ? value : null;
    };
    const asset = await addAsset(
      projectId,
      { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
      {
        kind: text("kind") ?? undefined,
        feature: text("feature"),
        tags: text("tags"),
        capturedAt: parseDay(text("capturedOn")),
        note: text("note"),
      },
    );
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
