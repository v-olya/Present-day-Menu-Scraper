import { GET, POST } from "../route";
import { NextRequest } from "next/server";
import * as dbManager from "../../../db/db_manager";

const getTodayDate = () => new Date().toISOString().split("T")[0];

type MockedDb = {
  get: jest.MockedFunction<
    (
      sql: string,
      ...params: unknown[]
    ) => Promise<Record<string, unknown> | undefined>
  >;
  run: jest.MockedFunction<
    (sql: string, ...params: unknown[]) => Promise<void>
  >;
};

jest.mock("../../../db/db_manager", () => ({
  db: {
    get: jest.fn(),
    run: jest.fn(),
  },
  notifyOnNewMenu: jest.fn(),
}));

describe("/cache API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns cached data if exists", async () => {
    const cachedData = JSON.stringify({
      restaurant_name: "Cached Cafe",
      menu_items: [
        {
          category: "soup",
          name: "Cached Soup",
          price: 40,
          allergens: [],
          weight: "300g",
        },
      ],
    });
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue({
      response: cachedData,
    });

    const req = new NextRequest(
      "http://localhost/cache?url=https://example.com"
    );
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.menu).toEqual({
      restaurant_name: "Cached Cafe",
      menu_items: [
        {
          category: "soup",
          name: "Cached Soup",
          price: 40,
          allergens: [],
          weight: "300g",
        },
      ],
    });
    expect((dbManager.db as unknown as MockedDb).get).toHaveBeenCalledWith(
      "SELECT response FROM cache WHERE key = ?",
      `https://example.com_${getTodayDate()}`
    ); // Assuming today's date
  });

  it("GET returns 404 if no cache", async () => {
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue(undefined);

    const req = new NextRequest(
      "http://localhost/cache?url=https://example.com"
    );
    const response = await GET(req);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.response).toBeNull();
  });

  it("POST stores data in cache", async () => {
    // On insert/update we get `changes()` to determine if it was a new entry
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue({ changes: 1 }); // inserted
    (dbManager.db as unknown as MockedDb).run.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: {
          restaurant_name: "Fancy Cafe",
          menu_items: [
            {
              category: "soup",
              name: "Soup",
              price: 50,
              allergens: [],
              weight: "200g",
            },
          ],
        },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      2,
      "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
      `https://example.com_${getTodayDate()}`,
      JSON.stringify({
        restaurant_name: "Fancy Cafe",
        menu_items: [
          {
            category: "soup",
            name: "Soup",
            price: 50,
            allergens: [],
            weight: "200g",
          },
        ],
        source_url: "https://example.com",
      })
    );
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM polling WHERE url = ?",
      "https://example.com"
    );
    expect(dbManager.notifyOnNewMenu).toHaveBeenCalledWith("Fancy Cafe");
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
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue({
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
    // Simulate existing cache entry (it would be changes=2 after REPLACE)
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue({ changes: 2 });
    (dbManager.db as unknown as MockedDb).run.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: {
          restaurant_name: "Cafe",
          menu_items: [
            {
              category: "soup",
              name: "Soup",
              price: 50,
              allergens: [],
              weight: "200g",
            },
          ],
        },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(dbManager.notifyOnNewMenu).not.toHaveBeenCalled();
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      2,
      "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
      `https://example.com_${getTodayDate()}`,
      JSON.stringify({
        restaurant_name: "Cafe",
        menu_items: [
          {
            category: "soup",
            name: "Soup",
            price: 50,
            allergens: [],
            weight: "200g",
          },
        ],
        source_url: "https://example.com",
      })
    );
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM polling WHERE url = ?",
      "https://example.com"
    );
  });

  it("POST notifies with provided restaurant_name when creating new entry", async () => {
    (dbManager.db as unknown as MockedDb).get.mockResolvedValue({ changes: 1 }); // inserted
    (dbManager.db as unknown as MockedDb).run.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/cache", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com",
        response: {
          restaurant_name: "Fancy Cafe",
          menu_items: [
            {
              category: "soup",
              name: "Soup",
              price: 50,
              allergens: [],
              weight: "200g",
            },
          ],
        },
      }),
    });
    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      2,
      "INSERT OR REPLACE INTO cache (key, response) VALUES (?, ?)",
      `https://example.com_${getTodayDate()}`,
      JSON.stringify({
        restaurant_name: "Fancy Cafe",
        menu_items: [
          {
            category: "soup",
            name: "Soup",
            price: 50,
            allergens: [],
            weight: "200g",
          },
        ],
        source_url: "https://example.com",
      })
    );
    expect((dbManager.db as unknown as MockedDb).run).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM polling WHERE url = ?",
      "https://example.com"
    );
    expect(dbManager.notifyOnNewMenu).toHaveBeenCalledWith("Fancy Cafe");
  });
});
