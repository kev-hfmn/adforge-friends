// Whether a caption may be written. The studio checks decide `blocked`.
// A blocked caption is never left as approved copy.

export function captionSaveDecision(input: {
  blocked: boolean;
  asDraft: boolean;
}): "refuse" | "draft" | "save" {
  if (!input.blocked) return "save";
  if (!input.asDraft) return "refuse";
  return "draft";
}

export function requireOwnerSaid(value: string): string {
  const quote = value.trim();
  if (!quote) throw new Error("approve_week needs the words the owner said.");
  return quote;
}
