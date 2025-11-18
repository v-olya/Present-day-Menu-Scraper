import { GET, POST } from "../route";
import { NextRequest } from "next/server";
import * as dbManager from "../../../db/db_manager";

const getTodayDate = () => new Date().toISOString().split("T")[0];

type MockedDb = {
  getAsync: jest.MockedFunction<
    (
      sql: string,
      ...params: unknown[]
    ) => Promise<Record<string, unknown> | undefined>
  >;
  runAsync: jest.MockedFunction<
    (sql: string, ...params: unknown[]) => Promise<void>
  >;
};

jest.mock("../../../db/db_manager", () => ({
  db: {
    getAsync: jest.fn(),
    runAsync: jest.fn(),
  },
  notifyOnNewMenu: jest.fn(),
}));

describe("/cache API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns cached data if exists", async () => {
    const cachedData = JSON.stringify({ menu: "cached menu" });
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue({
      response: cachedData,
    });

    const req = new NextRequest(
      "http://localhost/cache?url=https://example.com"
    );
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.response.menu).toEqual({ menu: "cached menu" });
    expect((dbManager.db as unknown as MockedDb).getAsync).toHaveBeenCalledWith(
      "SELECT response FROM cache WHERE key = ?",
      `https://example.com_${getTodayDate()}`
    ); // Assuming today's date
  });

  it("GET returns 404 if no cache", async () => {
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost/cache?url=https://example.com"
    );
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.response).toBeNull();
  });

  it("POST stores data in cache", async () => {
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue(undefined); // No existing
    (dbManager.db as unknown as MockedDb).runAsync.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: { menu: "new menu" },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect((dbManager.db as unknown as MockedDb).runAsync).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
      `https://example.com_${getTodayDate()}`,
      JSON.stringify({ menu: "new menu" })
    );
    expect(dbManager.notifyOnNewMenu).toHaveBeenCalledWith("Unknown");
  });

  it("GET returns 400 when url param is missing", async () => {
    const req = new NextRequest("http://localhost/cache");
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe("Missing url parameter");
  });

  it("GET returns 500 when cached data is invalid JSON", async () => {
    // db returns a string that is not valid JSON
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue({
      response: "not-a-json",
    });

    const req = new NextRequest(
      "http://localhost/cache?url=https://example.com"
    );
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.error).toBe("Invalid cached data");
  });

  it("POST returns 400 when body is missing url or response", async () => {
    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe("Missing url or response in body");
  });

  it("POST does not notify when cache entry already exists", async () => {
    // Simulate existing cache entry
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue({
      exists: 1,
    });
    (dbManager.db as unknown as MockedDb).runAsync.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: { restaurant_name: "Cafe", menu: [] },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(dbManager.notifyOnNewMenu).not.toHaveBeenCalled();
    expect((dbManager.db as unknown as MockedDb).runAsync).toHaveBeenCalled();
  });

  it("POST notifies with provided restaurant_name when creating new entry", async () => {
    (dbManager.db as unknown as MockedDb).getAsync.mockResolvedValue(undefined); // No existing
    (dbManager.db as unknown as MockedDb).runAsync.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: { restaurant_name: "Fancy Cafe", menu: [] },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(dbManager.notifyOnNewMenu).toHaveBeenCalledWith("Fancy Cafe");
  });
});
