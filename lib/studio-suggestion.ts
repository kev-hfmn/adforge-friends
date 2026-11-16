// A suggested replacement for part of a caption. Accepting it is a separate step.
export type CaptionSuggestion = {
  field: "caption" | "hashtags" | "firstComment";
  from: number;
  to: number;
  text: string;
};

export function parseSuggestion(value: string | null | undefined): CaptionSuggestion | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CaptionSuggestion>;
    if (
      (parsed.field === "caption" || parsed.field === "hashtags" || parsed.field === "firstComment") &&
      typeof parsed.from === "number" &&
      typeof parsed.to === "number" &&
      typeof parsed.text === "string"
    )
      return { field: parsed.field, from: parsed.from, to: parsed.to, text: parsed.text };
  } catch {
    return null;
  }
  return null;
}

export function applySuggestion(current: string, suggestion: CaptionSuggestion): string {
  const from = Math.max(0, Math.min(current.length, suggestion.from));
  const to = Math.max(from, Math.min(current.length, suggestion.to));
  return current.slice(0, from) + suggestion.text + current.slice(to);
}
