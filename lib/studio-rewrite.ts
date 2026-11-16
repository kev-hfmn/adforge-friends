// A rewrite for generator projects. It returns text. It does not write the caption.
import Anthropic from "@anthropic-ai/sdk";
import { contextFor } from "./kb";

export async function suggestCaption(projectId: string, caption: string, instruction: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Add an Anthropic key before asking for a rewrite.");
  const context = contextFor(projectId, { topic: caption.slice(0, 180) });
  const anthropic = new Anthropic({ apiKey: key });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: [
      "You rewrite a social caption.",
      "Return only the new caption.",
      "No em dash or en dash. Use a comma, a period, or a colon.",
      "Do not add a number that is not already in the caption or the notes.",
      "",
      "Notes:",
      context.text || "(This project has no matching hub entries.)",
    ].join("\n"),
    messages: [{ role: "user", content: `${instruction}\n\nCaption:\n${caption}` }],
  });
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim()
    .replace(/[\u2014\u2013]/g, ", ");
  if (!text) throw new Error("The rewrite came back empty.");
  return text;
}
