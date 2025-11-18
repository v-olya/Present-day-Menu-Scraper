jest.mock("openai", () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    mockCreate,
  };
});
jest.mock("playwright", () => {
  const mockLaunch = jest.fn();
  return {
    chromium: { launch: mockLaunch },
    mockLaunch,
  };
});
jest.mock("../../../db/db_manager", () => {
  return {
    __esModule: true,
    db: {
      run: jest.fn().mockResolvedValue(undefined),
      all: jest.fn().mockResolvedValue([]),
    },
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";
import * as dbManager from "../../../db/db_manager";
import { ERROR_MESSAGES } from "../../helpers/const";

const { mockCreate } = jest.requireMock("openai") as unknown as {
  mockCreate: jest.Mock;
};
const { mockLaunch } = jest.requireMock("playwright") as unknown as {
  mockLaunch: jest.Mock;
};

//*** Helper section ***//

function makeReq(url = "https://example.com") {
  return new NextRequest("http://localhost/menu", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

function makeMockPage({
  text = "scraped menu text",
  largestImageSrc = null,
} = {}) {
  return {
    goto: jest.fn(),
    evaluate: jest.fn().mockResolvedValue({ text, largestImageSrc }),
    close: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    request: {
      get: jest.fn().mockResolvedValue({
        ok: jest.fn().mockReturnValue(true),
        body: jest.fn().mockResolvedValue(Buffer.from("image")),
      }),
    },
    locator: jest.fn().mockReturnValue({
      count: jest.fn().mockResolvedValue(0),
      first: jest
        .fn()
        .mockReturnValue({ count: jest.fn().mockResolvedValue(0) }),
    }),
  };
}

function mockDbResolve(value?: unknown) {
  (dbManager.db.run as jest.Mock).mockResolvedValue(value);
}

function mockDbRejectOnce(err: unknown = new Error("DB ERROR")) {
  (dbManager.db.run as jest.Mock).mockRejectedValueOnce(err);
}

//*** End Helpers section ***//

describe("/menu POST Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset db mock to success by default
    mockDbResolve(undefined);

    // Mock Playwright
    const mockPage = makeMockPage();
    const mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };
    const mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    };
    mockLaunch.mockResolvedValue(mockBrowser);

    // Mock OpenAI
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              restaurant_name: "Test Restaurant",
              date: "2023-10-01",
              menu_items: [
                {
                  category: "Main",
                  name: "Pizza",
                  price: 10,
                  allergens: [],
                  weight: "200g",
                },
              ],
              rationale: ["Extracted menu"],
              menu_type: "daily",
              reason: null,
            }),
          },
        },
      ],
    };
    mockCreate.mockResolvedValue(mockResponse);
  });

  it("Full Analysis Flow: scrapes, calls LLM, and returns menu", async () => {
    const req = makeReq();

    const response = await POST(req);
    const result = await response.json();

    // Basic response checks
    expect(response.status).toBe(200);
    expect(result).toHaveProperty("menu");
    expect(result.menu.restaurant_name).toBe("Test Restaurant");

    // Verify browser and LLM were invoked
    expect(mockLaunch).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();

    // Ensure OpenAI was invoked with expected stuff
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: "scraped menu text",
          }),
        ]),
      }),
      expect.any(Object)
    );

    // DB manager should not start polling because menu_items exist -->> assert the polling INSERT was not executed,
    expect(dbManager.db.run as jest.Mock).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO polling"),
      expect.anything(),
      expect.anything()
    );
  });

  it("DB failure: returns 500 and does not crash when db.run rejects", async () => {
    // Make LLM return (valid) empty menu for route to call db.run
    const mockEmptyResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              restaurant_name: "Test Restaurant",
              date: "2023-10-01",
              menu_items: [],
              rationale: [],
              menu_type: "daily",
              reason: "NO_MENU_ITEMS",
            }),
          },
        },
      ],
    };
    mockCreate.mockResolvedValueOnce(mockEmptyResponse);

    // Make the DB fail when inserting polling
    mockDbRejectOnce(new Error("DB ERROR"));

    const req = makeReq();

    // Act
    const response = await POST(req);
    const body = await response.json();

    // Assert: route should return 500 and UNKNOWN_ERROR
    expect(response.status).toBe(500);
    expect(body).toHaveProperty("error", ERROR_MESSAGES.UNKNOWN_ERROR);
  });
});
