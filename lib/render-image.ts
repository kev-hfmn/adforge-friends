import type React from "react";
import ImageResponse from "@takumi-rs/image-response";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Renders a Takumi element to a PNG on disk. Filesystem only.
export async function renderImage(element: React.ReactElement, width: number, height: number, outputPath: string) {
  const response = new ImageResponse(element, { width, height, format: "png" });
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return outputPath;
}
