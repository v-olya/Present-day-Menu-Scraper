import { ERROR_MESSAGES } from "../helpers/const";
import { getMainSection } from "../helpers/scraper";
import { extractMenuFromHTML } from "../helpers/llm";
import { DetectedMenu } from "../helpers/types";
import { AiError } from "../helpers/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body?.url;

    // Try a lightweight fetch to just check if the URL responds OK
    let headRes: Response;
    try {
      // Don't re-validate the URL (FE does), rely on catch
      headRes = await fetch(url, { method: "GET", signal: req.signal });
    } catch (err) {
      console.error("Fetch error:", err);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNREACHABLE_URL }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }
    if (!headRes.ok) {
      return new Response(
        JSON.stringify({
          error: `${ERROR_MESSAGES.UNREACHABLE_URL} Status ${headRes.status}`,
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Proceed with heavy Playwright parsing
    let scraped;
    try {
      scraped = await getMainSection(url);
    } catch (err: unknown) {
      if (err instanceof Error && err?.message === "NAVIGATION_FAILED") {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.NAVIGATION_FAILED }),
          { status: 502, headers: { "content-type": "application/json" } }
        );
      }
      if (err instanceof Error && err.message === "EXTRACTION_FAILED") {
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.EXTRACTION_FAILED }),
          { status: 500, headers: { "content-type": "application/json" } }
        );
      }
      throw err;
    }
    let menu: DetectedMenu | null = null;
    let parsed;

    try {
      parsed = await extractMenuFromHTML(
        scraped.text,
        scraped.restaurant,
        scraped.image_url,
        req.signal
      );
      menu = parsed ? JSON.parse(parsed) : null;
    } catch (e) {
      console.error("LLM output parsing error:", e);
      if (e instanceof AiError) {
        const payload = e.payload as { parsed?: unknown } | undefined;
        console.error("AI error:", { code: e.code, details: payload ?? {} });
        const errMsg =
          ERROR_MESSAGES[`AI_${e.code}`] ??
          ERROR_MESSAGES.FAILED_PROCESS_MENU_AI;
        const parsedValue = payload?.parsed ?? parsed ?? null;
        return new Response(
          JSON.stringify({
            error: errMsg,
            parsed: parsedValue,
            menu: null,
            scraped,
          }),
          { status: 502, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          error: ERROR_MESSAGES.FAILED_PROCESS_MENU_AI,
          parsed: parsed ?? null,
          menu: null,
          scraped,
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    // If the scraper detected a restaurant name, prefer it over the LLM result.
    if (menu && scraped.restaurant.trim()) {
      menu.restaurant_name = scraped.restaurant.trim();
    }

    if (menu) {
      menu.source_url = url;
      if (scraped.image_base64) {
        menu.image_base64 = scraped.image_base64;
      }
      return new Response(
        JSON.stringify({ parsed: parsed ?? null, menu, scraped }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: ERROR_MESSAGES.FAILED_EXTRACT_MENU,
          parsed: parsed ?? null,
          menu: null,
          scraped,
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  } catch (err: unknown) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.UNKNOWN_ERROR }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
