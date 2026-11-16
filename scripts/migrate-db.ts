// Apply pending migrations (drizzle/migrations) to the database the app uses:
// ADFORGE_DB when set, else ./db.sqlite. Creates the file on a fresh checkout.
// Additive and safe to run twice. Run after every pull that adds a migration:
//   npx tsx scripts/migrate-db.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const file = process.env.ADFORGE_DB || "db.sqlite";
const sqlite = new Database(file);
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");
migrate(drizzle(sqlite), { migrationsFolder: "drizzle/migrations" });
console.log(`[migrate] ${file} is up to date`);
sqlite.close();
