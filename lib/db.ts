import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/drizzle/schema";

// ADFORGE_DB points the app (and scripts) at another database file; default ./db.sqlite.
export const sqlite = new Database(process.env.ADFORGE_DB || "db.sqlite");
// busy_timeout first: many build workers open the file at once, and switching a
// fresh file to WAL needs a moment of exclusive access.
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
