// What the caption studio needs from a project's hub. Any project: facts ground
// numbers, banned lines block, voice rules warn. An empty hub means no extra
// rules, and every number is unsourced.
import { sqlite } from "./db";
import { entriesByType, searchEntries, type HubRow } from "./kb-store";
import { numbersIn } from "./kb-types";
import type { BannedPhrase } from "./studio-check";

export type NumberSource = {
  value: string;
  entryId: string;
  title: string;
  insert: string;
};

export type GroundingItem = {
  id: string;
  type: string;
  title: string;
  insert: string;
};

export type StudioSources = {
  numbers: NumberSource[];
  banned: BannedPhrase[];
  voiceRules: string[];
  checklist: string[];
  related: GroundingItem[];
};

const empty: StudioSources = {
  numbers: [],
  banned: [],
  voiceRules: [],
  checklist: [],
  related: [],
};

function field(entry: HubRow, key: string): string {
  const value = entry.fields[key];
  return typeof value === "string" ? value : "";
}

function list(entry: HubRow, key: string): string[] {
  const value = entry.fields[key];
  if (Array.isArray(value)) return value.filter((item) => item.trim());
  return [];
}

function insertFor(entry: HubRow): string {
  return field(entry, "safeWording") || field(entry, "claim") || entry.title;
}

export function studioSources(projectId: string, topic = ""): StudioSources {
  try {
    const facts = entriesByType(sqlite, projectId, ["fact"], 400);
    const bannedRows = entriesByType(sqlite, projectId, ["banned"], 200);
    const voice = entriesByType(sqlite, projectId, ["voice_rule"], 80);
    const shapes = entriesByType(sqlite, projectId, ["story_shape"], 20);
    const numbers: NumberSource[] = [];
    const seen = new Set<string>();
    for (const fact of facts) {
      const tokens = [
        ...list(fact, "allowedNumbers"),
        ...numbersIn(`${field(fact, "claim")} ${field(fact, "safeWording")}`),
      ];
      const insert = insertFor(fact);
      for (const value of tokens) {
        const key = `${value}:${fact.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        numbers.push({ value, entryId: fact.id, title: fact.title, insert });
      }
    }
    const banned: BannedPhrase[] = bannedRows.map((entry) => ({
      pattern: field(entry, "pattern") || entry.title,
      reason: field(entry, "reason") || "banned",
      replacement: field(entry, "replacement") || undefined,
    }));
    const checklist = shapes.flatMap((entry) => list(entry, "checklist"));
    const related = topic.trim()
      ? searchEntries(sqlite, projectId, topic, {
          types: ["fact", "myth", "example", "taste", "hook"],
          limit: 8,
          status: "active",
        }).map((entry) => ({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          insert: insertFor(entry),
        }))
      : [];
    return {
      numbers,
      banned,
      voiceRules: voice.map((entry) => field(entry, "rule") || entry.body || entry.title),
      checklist,
      related,
    };
  } catch (error) {
    if (/no such table/i.test(String(error))) return empty;
    throw error;
  }
}
