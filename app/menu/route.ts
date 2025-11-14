import { chromium } from "playwright";
import { ERROR_MESSAGES } from "../helpers/const";

type ParseResult = {
  text: string;
  imageBase64: string | null;
};

async function getMainSection(url: string): Promise<ParseResult> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });

  const popupCloseSelectors = [
    '[title="Close"]',
    '[title="Zavřít"]',
    '[aria-label="Close"]',
    '[aria-label="Zavřít"]',
    ".popup-close",
    ".modal-close",
    ".overlay-close",
  ];

  const cookieConsentSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Agree")',
    'button:has-text("Přijmout")',
    'button:has-text("Souhlasím")',
  ];

  for (const selector of [...popupCloseSelectors, ...cookieConsentSelectors]) {
    const overlay = page.locator(selector);
    if (await overlay.first().isVisible()) {
      try {
        await overlay.first().click({ timeout: 1000 });
        break;
      } catch {
        // ignore overlay removing errors
      }
    }
  }

  const { text, largestImageSrc } = await page.evaluate(() => {
    const temp =
      document.querySelector("main") ||
      document.querySelector("section") ||
      document.body;
    temp.querySelectorAll("script, style").forEach((el) => el.remove());

    const walker = document.createTreeWalker(
      temp,
      NodeFilter.SHOW_COMMENT,
      null
    );
    const comments: Comment[] = [];
    while (walker.nextNode()) {
      comments.push(walker.currentNode as Comment);
    }
    comments.forEach((comment) => comment.remove());

    function extractTextWithBreaks(element: Element): string {
      let output = "";
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          output += (node.textContent || "").trim() + " ";
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as HTMLElement).tagName.toLowerCase();
          const blockTags = ["p", "br", "div", "section", "header", "footer"];
          const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"];
          const listTags = ["li"];

          if (headingTags.includes(tag)) output += "\n\n";
          if (blockTags.includes(tag)) output += "\n";
          if (listTags.includes(tag)) output += "- ";

          output += extractTextWithBreaks(node as Element);

          if (headingTags.includes(tag)) output += "\n\n";
          if (blockTags.includes(tag)) output += "\n";
        }
      }
      return output;
    }

    const images = Array.from(temp.querySelectorAll("img"))
      .map((img) => ({
        src: img.src,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      }))
      .filter((img) => img.src && img.width && img.height);

    const largestImage = images.reduce(
      (max, img) => {
        const area = img.width * img.height;
        return area > max.width * max.height ? img : max;
      },
      { src: "", width: 0, height: 0 }
    );

    return {
      text: extractTextWithBreaks(temp).replace(/\s+\n/g, "\n").trim(),
      largestImageSrc: largestImage.src || null,
    };
  });

  let imageBase64: string | null = null;
  if (largestImageSrc) {
    try {
      const imageResponse = await page.goto(largestImageSrc);
      const buffer = await imageResponse?.body();
      imageBase64 = (buffer ?? "").toString("base64");
    } catch {
      imageBase64 = null;
    }
  }

  await browser.close();
  return { text, imageBase64 };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body?.url;

    // Try a lightweight fetch to check if the URL responds
    let headRes: Response;
    try {
      // Doesn't re-validate the URL, relies on catch
      headRes = await fetch(url, { method: "GET" });
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
        JSON.stringify({ error: `URL returned status ${headRes.status}` }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }
    // Proceed to parse with Playwright
    const parsed = await getMainSection(url);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
