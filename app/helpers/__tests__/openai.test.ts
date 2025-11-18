// Mock OpenAI
jest.mock("openai");

import { extractMenuFromHTML } from "../openai";
import OpenAI from "openai";
const mockCreate = jest.fn();

(
  OpenAI as unknown as {
    prototype: { chat: { completions: { create: typeof mockCreate } } };
  }
).prototype.chat = {
  completions: {
    create: mockCreate,
  },
};

describe("extractMenuFromHTML", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses valid LLM response and validates structure", async () => {
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
              rationale: ["Reason 1"],
              menu_type: "daily",
              reason: null,
            }),
          },
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await extractMenuFromHTML(
      "<html>content</html>",
      "Test Restaurant"
    );

    expect(result).toBeTruthy();
    const parsed = JSON.parse(result!);
    expect(parsed).toHaveProperty("restaurant_name", "Test Restaurant");
    expect(parsed.menu_items).toHaveLength(1);
  });

  it("throws error for invalid JSON response", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "invalid json",
          },
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    await expect(
      extractMenuFromHTML("<html>content</html>", "Test Restaurant")
    ).rejects.toThrow("RESPONSE_NOT_JSON");
  });

  it("throws error for schema validation failure", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              invalid_field: "data",
            }),
          },
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    await expect(
      extractMenuFromHTML("<html>content</html>", "Test Restaurant")
    ).rejects.toThrow("SCHEMA_VALIDATION_FAILED");
  });

  it("returns null when LLM response has no content", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: undefined,
          },
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await extractMenuFromHTML(
      "<html>content</html>",
      "Test Restaurant"
    );

    expect(result).toBeNull();
  });

  it("sends image payload when imageUrl is provided", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              restaurant_name: "Img Restaurant",
              date: "2023-10-01",
              menu_items: [
                {
                  category: "Main",
                  name: "Salad",
                  price: 5,
                  allergens: [],
                },
              ],
              rationale: ["r"],
              menu_type: "daily",
              reason: null,
            }),
          },
        },
      ],
    };

    mockCreate.mockResolvedValue(mockResponse);

    const imageUrl = "https://example.com/image.jpg";

    const result = await extractMenuFromHTML(
      "<html>content</html>",
      "Img Restaurant",
      imageUrl
    );

    expect(result).toBeTruthy();
    const parsed = JSON.parse(result!);
    expect(parsed).toHaveProperty("restaurant_name", "Img Restaurant");

    // Ensure the OpenAI call includes the image payload
    const calledArgs = mockCreate.mock.calls[0][0];
    const messages = calledArgs.messages;
    expect(Array.isArray(messages)).toBe(true);
    const userMessage = messages[1];
    expect(userMessage.role).toBe("user");
    // content should be an array with an image_url entry
    expect(Array.isArray(userMessage.content)).toBe(true);
    const imageEntry = (userMessage.content as unknown[]).find(
      (c: unknown) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type?: unknown }).type === "image_url"
    );
    expect(imageEntry).toBeDefined();
    const imageEntryObj = imageEntry as { image_url?: { url?: string } };
    expect(imageEntryObj.image_url?.url).toBe(imageUrl);
  });
});
