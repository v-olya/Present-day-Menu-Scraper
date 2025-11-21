import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import Ajv from "ajv";
import { getSystemPrompt } from "./const";
import { AiError } from "./errors";
import { withTimeout, retryAsync, isNetworkError } from "./functions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_NAME = "gpt-4o-mini";

const detectedMenuSchema = {
  type: "object",
  properties: {
    restaurant_name: { type: "string", maxLength: 100 },
    date: { type: "string", maxLength: 50 },
    reason: { type: ["string", "null"], maxLength: 200 },
    menu_items: {
      type: "array",
      minItems: 0,
      maxItems: 200,
      items: {
        type: "object",
        properties: {
          category: { type: "string", maxLength: 100 },
          name: { type: "string", maxLength: 200 },
          price: { type: ["number", "null"] },
          allergens: {
            type: "array",
            maxItems: 20,
            items: { type: "string", maxLength: 50 },
          },
          weight: { type: ["string", "null"], maxLength: 50 },
        },
        required: ["category", "name", "price", "allergens", "weight"],
        additionalProperties: false,
      },
    },
    rationale: {
      type: "array",
      description:
        "A short, ordered list of reasoning steps used to extract the menu",
      items: { type: "string", maxLength: 200 },
      maxItems: 50,
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
  imageUrl?: string | null,
  signal?: AbortSignal
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

  const callOpenAI = () =>
    withTimeout(
      openai.chat.completions.create(
        {
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
        },
        { signal }
      ),
      30000,
      signal
    );

  const res = await retryAsync(() => callOpenAI(), isNetworkError, signal);

  const content = (res as OpenAI.ChatCompletion).choices[0]?.message?.content;
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
