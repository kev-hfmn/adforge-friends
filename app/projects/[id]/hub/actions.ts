"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sqlite } from "@/lib/db";
import { createEntry, restoreVersion, setEntryStatus, updateEntry } from "@/lib/kb-store";
import { isKbType, type HubFields, type KbType } from "@/lib/kb-types";

function clean(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function fieldsFrom(type: KbType, formData: FormData): HubFields {
  const pick = (...names: string[]) => {
    const fields: HubFields = {};
    for (const name of names) {
      const value = clean(formData, name);
      if (value) fields[name] = name === "allowedNumbers" ? value.split(",").map((part) => part.trim()).filter(Boolean) : value;
    }
    return fields;
  };
  if (type === "fact") return pick("claim", "source", "safeWording", "neverSay", "allowedNumbers", "link");
  if (type === "voice_rule") return pick("rule", "doExample", "dontExample");
  if (type === "banned") return pick("pattern", "reason", "replacement");
  if (type === "myth") return pick("myth", "whatIsTrue", "source", "grade");
  if (type === "taste") return pick("date", "what", "verdict", "reason");
  if (type === "hook" || type === "example") return pick("post", "format");
  return {};
}

function tagsFrom(formData: FormData): string[] {
  return clean(formData, "tags")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

export async function addHubEntry(projectId: string, formData: FormData) {
  const type = clean(formData, "type");
  if (!isKbType(type)) throw new Error("Pick a type");
  const title = clean(formData, "title");
  if (!title) throw new Error("Add a title");
  const id = createEntry(sqlite, projectId, {
    type,
    title,
    body: clean(formData, "body"),
    fields: fieldsFrom(type, formData),
    tags: tagsFrom(formData),
    pillar: clean(formData, "pillar") || null,
  });
  revalidatePath(`/projects/${projectId}/hub`);
  redirect(`/projects/${projectId}/hub?entry=${id}`);
}

export async function saveHubEntry(projectId: string, entryId: string, formData: FormData) {
  const type = clean(formData, "type");
  if (!isKbType(type)) throw new Error("Pick a type");
  const title = clean(formData, "title");
  if (!title) throw new Error("Add a title");
  updateEntry(
    sqlite,
    projectId,
    entryId,
    {
      title,
      body: clean(formData, "body"),
      fields: fieldsFrom(type, formData),
      tags: tagsFrom(formData),
      pillar: clean(formData, "pillar") || null,
    },
    "owner",
  );
  revalidatePath(`/projects/${projectId}/hub`);
  redirect(`/projects/${projectId}/hub?entry=${entryId}`);
}

export async function keepTaste(projectId: string, entryId: string) {
  setEntryStatus(sqlite, projectId, entryId, "active");
  revalidatePath(`/projects/${projectId}/hub`);
}

export async function discardTaste(projectId: string, entryId: string) {
  setEntryStatus(sqlite, projectId, entryId, "retired");
  revalidatePath(`/projects/${projectId}/hub`);
  redirect(`/projects/${projectId}/hub?status=draft`);
}

export async function restoreHubVersion(projectId: string, entryId: string, versionId: string) {
  restoreVersion(sqlite, projectId, entryId, versionId);
  revalidatePath(`/projects/${projectId}/hub`);
}
