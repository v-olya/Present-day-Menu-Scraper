import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import Ajv from "ajv";
import { getSystemPrompt } from "./const";
import { AiError } from "./errors";
import { withTimeout } from "./functions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_NAME = "gpt-4o-mini";

const detectedMenuSchema = {
  type: "object",
  properties: {
    restaurant_name: { type: "string" },
    date: { type: "string" },
    reason: { type: ["string", "null"] },
    menu_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          allergens: {
            type: "array",
            items: { type: "string" },
          },
          weight: { type: "string" },
        },
        required: ["category", "name", "price", "allergens", "weight"],
        additionalProperties: false,
      },
    },
    rationale: {
      type: "array",
      description:
        "A short, ordered list of reasoning steps used to extract the menu",
      items: { type: "string" },
    },
    menu_type: {
      type: "string",
      enum: [
        "daily",
        "launch",
        "breakfast",
        "weekly",
        "weekend",
        "regular",
        "special",
      ],
    },
  },
  required: [
    "restaurant_name",
    "date",
    "menu_items",
    "reason",
    "menu_type",
    "rationale",
  ],
  additionalProperties: false,
};

export async function extractMenuFromHTML(
  htmlContent: string,
  restaurantName: string,
  imageUrl?: string | null
): Promise<string | null> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: getSystemPrompt(restaurantName) },
  ];

  if (imageUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: htmlContent },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    });
  } else {
    messages.push({ role: "user", content: htmlContent });
  }

  const res = await withTimeout(
    openai.chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "restaurant_menu",
          schema: detectedMenuSchema,
          strict: true,
        },
      },
    }),
    30000
  );

  const content = res.choices[0]?.message?.content;
  if (!content) return null;

  // Validate the returned content against the same JSON Schema using Ajv
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new AiError("RESPONSE_NOT_JSON", {
      originalMessage: String(e instanceof Error ? e.message : e),
    });
  }
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(detectedMenuSchema as Record<string, unknown>);
  const valid = validate(parsed);
  if (!valid) {
    const payload = { validationErrors: validate.errors, parsed };
    throw new AiError("SCHEMA_VALIDATION_FAILED", payload);
  }
  return JSON.stringify(parsed);
}
