// Calendar events added by hand (launches, holidays, deadlines) shown on the Plan.
// Nothing here publishes.
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { calendarEvents } from "@/drizzle/schema";
import type { PlanEvent } from "./plan";

function missingTable(error: unknown): boolean {
  return /no such table/i.test(String(error));
}

export async function listPlanEvents(
  projectId: string,
  start: string,
  end: string,
): Promise<PlanEvent[]> {
  try {
    const rows = await db.query.calendarEvents.findMany({
      where: and(
        eq(calendarEvents.projectId, projectId),
        gte(calendarEvents.date, start),
        lte(calendarEvents.date, end),
      ),
    });
    return rows
      .filter((row) => row.kind !== "cache" && row.title.trim())
      .map((row) => ({
        date: row.date,
        title: row.title,
        kind: row.kind ?? "manual",
        source: row.source ?? "manual",
        url: row.url,
      }));
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export async function addManualEvent(projectId: string, date: string, title: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a date");
  const text = title.trim();
  if (!text) throw new Error("Name the event");
  if (text.length > 80) throw new Error("Keep the name under 80 characters");
  await db.insert(calendarEvents).values({
    id: crypto.randomUUID(),
    projectId,
    date,
    title: text,
    kind: "manual",
    source: "owner",
    fetchedAt: Date.now(),
  });
}
