import { join } from "path";
import { readFile } from "fs/promises";

// Next.js production only serves /public files that existed at build time.
// Rendered PNGs/MP4s are written at runtime, so we serve them ourselves.
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (file.includes("..") || file.includes("/")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(join(process.cwd(), "public", "generated", file));
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
