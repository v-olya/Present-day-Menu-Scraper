import { NextRequest, NextResponse } from "next/server";
import { db, notifyOnNewMenu } from "../../db/db_manager";
import { withTimeout, normalizeUrl } from "../helpers/functions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }
  const date = new Date().toISOString().split("T")[0];
  const key = normalizeUrl(url) + "_" + date;
  return withTimeout(
    (async (): Promise<NextResponse> => {
      const row = await db.get("SELECT response FROM cache WHERE key = ?", key);
      if (
        row &&
        typeof row === "object" &&
        row !== null &&
        "response" in row &&
        typeof (row as { response: unknown }).response === "string"
      ) {
        try {
          const menu = JSON.parse((row as { response: string }).response);
          return NextResponse.json({ menu });
        } catch (parseErr) {
          console.error("Failed to parse cached data:", parseErr);
          return NextResponse.json(
            { error: "Invalid cached data" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json({ response: null }, { status: 404 });
      }
    })(),
    5000
  ).catch((err) =>
    NextResponse.json({ error: (err as Error).message }, { status: 500 })
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, response } = body;
  if (!url || !response) {
    return NextResponse.json(
      { error: "Missing url or response in body" },
      { status: 400 }
    );
  }
  if (!response.menu_items?.length) {
    return NextResponse.json(
      { error: "Response with empty menu_items" },
      { status: 400 }
    );
  }
  // Ensure table exists with PRIMARY KEY
  await db.run(
    "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, response TEXT)"
  );
  const date = new Date().toISOString().split("T")[0];
  const key = normalizeUrl(url) + "_" + date;

  return withTimeout(
    (async (): Promise<NextResponse> => {
      // Ensure store normalized URLs only
      response.source_url = normalizeUrl(url);
      await db.run(
        "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
        key,
        JSON.stringify(response)
      );
      // After `INSERT OR REPLACE` we read changes (per connection): insert => 1, replace => 2
      const changesRow = await db.get("SELECT changes() AS changes");
      const changes =
        typeof changesRow === "object" && "changes" in changesRow
          ? Number((changesRow as { changes: unknown }).changes) || 0
          : 0;
      const isNew = changes === 1;

      if (isNew) {
        const restaurantName = response.restaurant_name || "Unknown";
        notifyOnNewMenu(restaurantName);
      }
      // Remove from polling since menu is now cached manually
      await db.run("DELETE FROM polling WHERE url = ?", normalizeUrl(url));

      return NextResponse.json({ success: true });
    })(),
    5000 // 5s timeout
  ).catch((err) =>
    NextResponse.json({ error: (err as Error).message }, { status: 500 })
  );
}
