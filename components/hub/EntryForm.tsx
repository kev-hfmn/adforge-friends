"use client";

import { useState } from "react";
import { KB_TYPE_LABELS, KB_TYPES, type KbType } from "@/lib/kb-types";

const EXTRA: Partial<Record<KbType, { name: string; label: string }[]>> = {
  fact: [
    { name: "claim", label: "Claim" },
    { name: "source", label: "Source" },
    { name: "safeWording", label: "Safe wording" },
    { name: "neverSay", label: "Never say" },
    { name: "allowedNumbers", label: "Allowed numbers, comma separated" },
    { name: "link", label: "Link" },
  ],
  voice_rule: [
    { name: "rule", label: "Rule" },
    { name: "doExample", label: "Do this" },
    { name: "dontExample", label: "Not this" },
  ],
  banned: [
    { name: "pattern", label: "Word or pattern" },
    { name: "reason", label: "Reason" },
    { name: "replacement", label: "Replacement" },
  ],
  myth: [
    { name: "myth", label: "Myth" },
    { name: "whatIsTrue", label: "What is true" },
    { name: "source", label: "Source" },
    { name: "grade", label: "Grade" },
  ],
  taste: [
    { name: "date", label: "Date" },
    { name: "what", label: "What" },
    { name: "verdict", label: "Verdict" },
    { name: "reason", label: "Reason, in your words" },
  ],
  founder_story: [],
  hook: [{ name: "post", label: "Post it came from" }],
  example: [
    { name: "post", label: "Post" },
    { name: "format", label: "Format" },
  ],
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-input bg-field px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EntryForm({
  action,
  initial,
  lockType,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: { type: KbType; title: string; body: string; fields: Record<string, string> };
  lockType?: boolean;
}) {
  const [type, setType] = useState<KbType>(initial?.type ?? "note");
  const extras = EXTRA[type] ?? [];
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Type</span>
        <select
          name="type"
          value={type}
          disabled={lockType}
          onChange={(event) => setType(event.target.value as KbType)}
          className={fieldClass}
        >
          {KB_TYPES.map((item) => (
            <option key={item} value={item}>
              {KB_TYPE_LABELS[item]}
            </option>
          ))}
        </select>
      </label>
      {lockType && <input type="hidden" name="type" value={type} />}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Title</span>
        <input name="title" required defaultValue={initial?.title ?? ""} className={fieldClass} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Body</span>
        <textarea name="body" rows={6} defaultValue={initial?.body ?? ""} className={`${fieldClass} py-2`} />
      </label>
      {extras.map((field) => (
        <label key={field.name} className="block space-y-1 text-sm">
          <span className="font-medium">{field.label}</span>
          <input name={field.name} defaultValue={initial?.fields[field.name] ?? ""} className={fieldClass} />
        </label>
      ))}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Pillar</span>
        <input name="pillar" defaultValue="" className={fieldClass} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Tags</span>
        <input name="tags" placeholder="comma separated" className={fieldClass} />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
        Save entry
      </button>
    </form>
  );
}
