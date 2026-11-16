import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";

// Lists what POST /api/upload already saved for this project, newest first, so
// screenshots get uploaded once and reused across every post.
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  // Path traversal guard — projectId lands in a filesystem path
  if (!/^[a-zA-Z0-9-]+$/.test(projectId)) {
    return NextResponse.json({ error: "invalid projectId" }, { status: 400 });
  }

  const dir = join(process.cwd(), "public", "uploads", projectId);
  try {
    const names = await readdir(dir);
    const withTimes = await Promise.all(
      names
        .filter((n) => /\.(png|jpe?g|webp|gif)$/i.test(n))
        .map(async (n) => ({ name: n, mtime: (await stat(join(dir, n))).mtimeMs }))
    );
    withTimes.sort((a, b) => b.mtime - a.mtime);
    return NextResponse.json({ paths: withTimes.map((f) => `/uploads/${projectId}/${f.name}`) });
  } catch {
    return NextResponse.json({ paths: [] }); // no uploads yet
  }
}
