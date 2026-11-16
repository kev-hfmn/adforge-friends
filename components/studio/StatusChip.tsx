/** One status chip for Plan, Posts, and the post sheet. */
export function chipOf(word: string): { kind: string; label: string } {
  const text = word.trim();
  if (text === "Posted") return { kind: "posted", label: "Posted" };
  if (text === "Scheduled" || text === "Due" || text.startsWith("Due"))
    return { kind: "scheduled", label: "Scheduled" };
  if (text === "Failed" || text.startsWith("Failed")) return { kind: "failed", label: "Failed" };
  if (
    text === "Needs you" ||
    text === "Needs your OK" ||
    text.startsWith("Needs") ||
    text === "Time passed" ||
    text === "No time"
  )
    return { kind: "needs", label: "Needs you" };
  return { kind: "draft", label: text || "Draft" };
}

export function StatusChip({ word }: { word: string }) {
  const { kind, label } = chipOf(word);
  return <span className={`status-chip status-${kind}`}>{label}</span>;
}
