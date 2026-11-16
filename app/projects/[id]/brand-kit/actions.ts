"use server";

import { revalidatePath } from "next/cache";
import {
  saveBrandKit,
  parseBrandKitMarkdown,
  getBrandKitFields,
  type BrandKitFields,
  emptyBrandKitFields,
} from "@/lib/brand-kit";

export type SaveBrandKitResult = { success: true } | { success: false; error: string };

function formToFields(formData: FormData): BrandKitFields {
  const base = emptyBrandKitFields();
  let colors = base.colors;
  let typography = base.typography;
  let contentPillars = base.contentPillars;
  let formats = base.formats;
  let allowedPaletteIds = base.allowedPaletteIds;
  let bannedLayoutStyles = base.bannedLayoutStyles;

  try {
    colors = JSON.parse(String(formData.get("colorsJson") || "{}"));
  } catch {
    /* keep default */
  }
  try {
    typography = JSON.parse(String(formData.get("typographyJson") || "{}"));
  } catch {
    /* keep default */
  }
  try {
    contentPillars = JSON.parse(String(formData.get("contentPillarsJson") || "[]"));
  } catch {
    /* keep default */
  }
  try {
    formats = JSON.parse(String(formData.get("formatsJson") || "[]"));
  } catch {
    /* keep default */
  }

  const palettesRaw = String(formData.get("allowedPaletteIds") || "");
  allowedPaletteIds = palettesRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const bannedRaw = String(formData.get("bannedLayoutStyles") || "");
  bannedLayoutStyles = bannedRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Primary/background color pickers override JSON tokens
  const primary = String(formData.get("colorPrimary") || colors.primary || "");
  const background = String(formData.get("colorBackground") || colors.background || "");
  colors = { ...colors, primary, background };

  return {
    northStar: String(formData.get("northStar") || ""),
    oneLiner: String(formData.get("oneLiner") || ""),
    antiReferences: String(formData.get("antiReferences") || ""),
    colors,
    typography: {
      ...typography,
      family: String(formData.get("typeFamily") || typography.family || ""),
      maxWeight: Number(formData.get("typeMaxWeight") || typography.maxWeight || 600),
      notes: String(formData.get("typeNotes") || typography.notes || ""),
    },
    uiNotes: String(formData.get("uiNotes") || ""),
    visualDos: String(formData.get("visualDos") || ""),
    visualDonts: String(formData.get("visualDonts") || ""),
    rejectGate: String(formData.get("rejectGate") || ""),
    imageStyleLock: String(formData.get("imageStyleLock") || ""),
    imageStyleLockNoText: String(formData.get("imageStyleLockNoText") || ""),
    contentPillars,
    formats,
    editorialRules: String(formData.get("editorialRules") || ""),
    ctaFacts: String(formData.get("ctaFacts") || ""),
    allowedPaletteIds,
    bannedLayoutStyles,
    fullMarkdown: String(formData.get("fullMarkdown") || ""),
  };
}

export async function saveBrandKitAction(
  projectId: string,
  formData: FormData
): Promise<SaveBrandKitResult> {
  try {
    const fields = formToFields(formData);
    await saveBrandKit(projectId, fields);
    revalidatePath(`/projects/${projectId}/brand-kit`);
    revalidatePath(`/projects/${projectId}/generate`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function importBrandKitMarkdownAction(
  projectId: string,
  markdown: string
): Promise<SaveBrandKitResult> {
  try {
    const existing = await getBrandKitFields(projectId);
    const parsed = parseBrandKitMarkdown(markdown, existing);
    await saveBrandKit(projectId, parsed);
    revalidatePath(`/projects/${projectId}/brand-kit`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Import failed" };
  }
}
