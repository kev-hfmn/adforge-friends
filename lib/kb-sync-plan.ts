// Decides what a sync run inserts, updates or retires. Pure: no database.

import { fingerprint, type HubEntryDraft } from "./kb-types";

export type StoredSyncRow = {
  id: string;
  syncKey: string;
  fingerprint: string;
  status: string;
};

export function planSync(
  existing: StoredSyncRow[],
  incoming: HubEntryDraft[],
  scopePrefixes: string[],
): {
  insert: HubEntryDraft[];
  update: { id: string; entry: HubEntryDraft }[];
  retire: string[];
} {
  const incomingByKey = new Map(incoming.map((entry) => [entry.syncKey, entry]));
  const existingByKey = new Map(existing.map((row) => [row.syncKey, row]));
  const insert: HubEntryDraft[] = [];
  const update: { id: string; entry: HubEntryDraft }[] = [];
  const retire: string[] = [];
  for (const entry of incoming) {
    const prev = existingByKey.get(entry.syncKey);
    if (!prev) insert.push(entry);
    else if (prev.status === "retired" || prev.fingerprint !== fingerprint(entry))
      update.push({ id: prev.id, entry });
  }
  for (const prev of existing) {
    if (incomingByKey.has(prev.syncKey) || prev.status === "retired") continue;
    if (scopePrefixes.some((prefix) => prev.syncKey.startsWith(prefix))) retire.push(prev.syncKey);
  }
  return { insert, update, retire };
}
