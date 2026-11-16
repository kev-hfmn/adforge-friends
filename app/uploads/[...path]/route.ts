import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { assetMime } from "@/lib/assets";

// Next.js production only serves /public files that existed at build time. Uploads
// arrive later, so they are served from disk here (as /generated files already are).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const parts = (await params).path;
  const root = join(process.cwd(), "public", "uploads");
  const file = normalize(join(root, ...parts));
  const type = assetMime(file);
  if (!file.startsWith(root + sep) || !type || parts.some((p) => p.startsWith(".")))
    return new Response("Not found", { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
