import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import cron from "node-cron";
import { getMainSection } from "../app/helpers/scraper";
import { extractMenuFromHTML } from "../app/helpers/openai";

process.env.TZ = "UTC";

const dbPath = path.join(process.cwd(), "db", "responses.db");

const db = await open({ filename: dbPath, driver: sqlite3.Database });

// Create tables
await db.run(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

await db.run(`CREATE TABLE IF NOT EXISTS polling (
  url TEXT PRIMARY KEY,
  last_hash TEXT
)`);

// Callback for change notification (sends to Discord)
const notifyOnNewMenu = async (restaurantName: string) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL not set");
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${restaurantName}: Menu changed`,
      }),
    });
    console.log(`${restaurantName}: Notification sent`);
  } catch (err) {
    console.error(`${restaurantName}: Notification failed`, err);
  }
};

// Schedule cleanup every midnight UTC
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      await db.run(`DELETE FROM cache WHERE key NOT LIKE '%_' || date('now')`);
      console.log("Cache cleaned");
    } catch (err) {
      console.error("Error cleaning cache:", err);
    }
  },
  {
    timezone: "UTC",
  }
);

// Schedule polling every hour
cron.schedule("0 * * * *", async () => {
  try {
    const pollingRows = await db.all("SELECT url, last_hash FROM polling");
    for (const row of pollingRows) {
      const url = row.url as string;
      const lastHash = row.last_hash as string;
      try {
        const scraped = await getMainSection(url);
        const crypto = await import("crypto");
        const newHash = crypto.default
          .createHash("sha256")
          .update(scraped.text)
          .digest("hex");
        if (newHash !== lastHash) {
          // Although we clean up HTML before computing the hash, expect false positives here
          // maybe bunners? clocks? whatever
          const parsed = await extractMenuFromHTML(
            scraped.text,
            scraped.restaurant,
            scraped.image_url
          );
          const menu = parsed ? JSON.parse(parsed) : null;
          if (menu?.menu_items?.length) {
            // Save to cache
            const date = new Date().toISOString().split("T")[0];
            const key = url + "_" + date;
            const response = {
              ...menu,
              source_url: url,
              image_base64: scraped.image_base64,
            };
            await db.run(
              "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
              key,
              JSON.stringify(response)
            );
            notifyOnNewMenu(menu.restaurant_name || scraped.restaurant);
            // Remove from polling
            await db.run("DELETE FROM polling WHERE url = ?", url);
          } else {
            // Update hash
            await db.run(
              "UPDATE polling SET last_hash = ? WHERE url = ?",
              newHash,
              url
            );
          }
        } else {
          // ignore
        }
      } catch (err) {
        console.error(`Error when polling ${url}:`, err);
      }
    }
  } catch (err) {
    console.error("Error in polling cron:", err);
  }
});

export { db, notifyOnNewMenu };
