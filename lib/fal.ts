import { fal } from "@fal-ai/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set in environment");
  fal.config({ credentials: key });
  configured = true;
}

export type FalAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface FalImageResult {
  /** Local /public path (e.g. "/generated/fal-abc.png") */
  publicPath: string;
  /** Original signed URL returned by FAL */
  sourceUrl: string;
  width?: number;
  height?: number;
}

/**
 * Generate an image with Nano Banana text-to-image and persist it under public/generated.
 */
export async function generateFalImage(
  prompt: string,
  aspectRatio: FalAspectRatio = "1:1",
  fileStem?: string
): Promise<FalImageResult> {
  ensureConfigured();
  const result = await fal.subscribe("fal-ai/nano-banana", {
    input: {
      prompt,
      num_images: 1,
      aspect_ratio: aspectRatio,
      output_format: "png",
    },
    logs: false,
  });
  const image = result.data?.images?.[0];
  if (!image?.url) throw new Error("FAL: no image returned");
  return await downloadAndSave(image.url, fileStem ?? `fal-${uuidv4()}`, image.width, image.height);
}

/**
 * Edit an existing image (image-to-image) — used for iteration / variations.
 */
export async function editFalImage(
  prompt: string,
  imageUrls: string[],
  fileStem?: string
): Promise<FalImageResult> {
  ensureConfigured();
  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: "png",
    },
    logs: false,
  });
  const image = result.data?.images?.[0];
  if (!image?.url) throw new Error("FAL: no image returned from edit");
  return await downloadAndSave(image.url, fileStem ?? `fal-edit-${uuidv4()}`, image.width, image.height);
}

async function downloadAndSave(
  url: string,
  stem: string,
  width?: number,
  height?: number
): Promise<FalImageResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FAL: failed to download image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const fileName = `${stem}.png`;
  await writeFile(join(dir, fileName), buf);
  return { publicPath: `/generated/${fileName}`, sourceUrl: url, width, height };
}

// Used when the project's Brand Kit has no image style lock yet.
const FAL_STYLE_FALLBACK =
  "Style: clean editorial photography, natural light, minimalist composition with generous negative space. " +
  "Avoid logos, watermarks and phone screens.";
const FAL_NO_TEXT = "Absolutely no text, letters, or numbers in the image.";

/**
 * FAL generation with the project's Brand Kit image style lock, or a neutral
 * fallback style when the kit has none. fal_background images never carry text.
 */
export async function generateBrandFal(
  prompt: string,
  imageMode: "fal_background" | "fal_full" | string,
  fileStem: string,
  projectId: string,
  aspectRatio: FalAspectRatio = "1:1",
): Promise<FalImageResult> {
  const { applyImageStyleLock, getBrandKitFields } = await import("./brand-kit");
  const fields = await getBrandKitFields(projectId);
  const locked = fields.imageStyleLock
    ? await applyImageStyleLock(projectId, prompt, imageMode)
    : `${prompt}\n\n${imageMode === "fal_full" ? FAL_STYLE_FALLBACK : `${FAL_STYLE_FALLBACK} ${FAL_NO_TEXT}`}`;
  return generateFalImage(locked, aspectRatio, fileStem);
}
