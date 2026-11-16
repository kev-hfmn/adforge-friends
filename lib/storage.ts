import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");
const GENERATED_DIR = path.join(process.cwd(), "public/generated");

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function saveUploadedFile(file: File): Promise<string> {
  await ensureDir(UPLOAD_DIR);
  const ext = path.extname(file.name) || ".png";
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);
  return `/uploads/${filename}`;
}

export async function saveGeneratedImage(buffer: Buffer, postId: string, format: "png" | "webp" = "png"): Promise<string> {
  await ensureDir(GENERATED_DIR);
  const filename = `${postId}.${format}`;
  const filepath = path.join(GENERATED_DIR, filename);
  await writeFile(filepath, buffer);
  return `/generated/${filename}`;
}
