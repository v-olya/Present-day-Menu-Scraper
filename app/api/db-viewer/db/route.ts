import fs from "fs";
import path from "path";

export async function GET() {
  const dbPath = path.join(process.cwd(), "db", "responses.db");

  try {
    const dbBuffer = fs.readFileSync(dbPath);
    return new Response(dbBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="responses.db"',
      },
    });
  } catch {
    return new Response("Database file not found", { status: 404 });
  }
}
