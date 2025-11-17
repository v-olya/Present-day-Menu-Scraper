import sqlite3 from "sqlite3";
import path from "path";
import cron from "node-cron";

process.env.TZ = "UTC";

const dbPath = path.join(process.cwd(), "cache", "responses.db");

interface AsyncDatabase extends sqlite3.Database {
  //can't use @types/sqlite3 because it seems outdated
  runAsync(sql: string, ...params: unknown[]): Promise<void>;
  getAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<Record<string, unknown> | undefined>;
  allAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<Record<string, unknown>[]>;
}

const db = new sqlite3.Database(dbPath) as AsyncDatabase;

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Schedule cleanup at midnight every day
cron.schedule("0 0 * * *", async () => {
  try {
    await db.runAsync(
      `DELETE FROM cache WHERE key NOT LIKE '%_' || date('now')`
    );
    console.log("Cache cleaned at midnight");
  } catch (err) {
    console.error("Error cleaning cache:", err);
  }
});

export { db };
