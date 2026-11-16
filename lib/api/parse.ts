import { z } from "zod";
import { toolCatalog } from "./catalog";

export function readInput<T>(name: string, input: unknown): T {
  const tool = toolCatalog.find((item) => item.name === name);
  if (!tool) throw new Error("Unknown tool");
  const parsed = (tool.input as z.ZodType<T>).safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    throw new Error(message || "Check the inputs");
  }
  return parsed.data;
}

export function actorFrom(input: unknown): "owner" | "claude" | "cron" {
  if (!input || typeof input !== "object" || !("actor" in input)) return "claude";
  const actor = (input as { actor?: unknown }).actor;
  if (actor === "owner" || actor === "claude" || actor === "cron") return actor;
  return "claude";
}
