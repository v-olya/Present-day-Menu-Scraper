import { chromium } from "playwright";
import type { Browser, Page, APIResponse, BrowserContext } from "playwright";
import { ParseResult } from "./types";
import { withTimeout, isImageUrlSafe, isBase64ImageSafe } from "./functions";

const restaurantKeywords = ["restaurace", "restaurant", "bistro", "pizzeria"];

export async function getMainSection(url: string): Promise<ParseResult> {
  const { origin } = new URL(url);
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  type EvalResult = { text: string; largestImageSrc: string | null };

  const defaultResult = (): ParseResult => ({
    text: "",
    image_url: null,
    image_base64: null,
    restaurant: "",
  });

  async function safeClose(
    resource: { close: () => Promise<void> },
    name: string
  ) {
    try {
      await resource.close();
    } catch (err) {
      console.debug(`${name}.close failed`, stringifyErr(err));
    }
  }

  try {
    browser = await chromium.launch({ timeout: 30000 });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(15000);
    // Try to resolve server-side redirects with a short request; fall back to original URL.
    let navigationUrl = url;
    try {
      const headResp = await page.request.get(url, { timeout: 5000 });
      if (headResp) navigationUrl = headResp.url();
    } catch {
      navigationUrl = url;
    }
    try {
      await page.goto(navigationUrl, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
    } catch {
      throw new Error("NAVIGATION_FAILED");
    }

    // Selectors for overlays and cookie banners
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

    for (const selector of [
      ...popupCloseSelectors,
      ...cookieConsentSelectors,
    ]) {
      try {
        const loc = page.locator(selector).first();
        if ((await loc.count()) && (await loc.isVisible())) {
          await loc
            .click({ timeout: 2000 })
            .catch((err: unknown) =>
              console.debug("overlay click failed", selector, stringifyErr(err))
            );
          break;
        }
      } catch {
        // ignore failures to dismiss overlays
      }
    }

    // Extract page text and find the largest non-data image.
    let text: string;
    let largestImageSrc: string | null;

    try {
      const res = await withTimeout(
        page.evaluate(() => {
          const root =
            document.querySelector("main") ||
            document.querySelector("section") ||
            document.body;
          root.querySelectorAll("script, style").forEach((el) => el.remove());

          // Remove HTML comments
          const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_COMMENT,
            null
          );
          const comments: Comment[] = [];
          while (walker.nextNode())
            comments.push(walker.currentNode as Comment);
          comments.forEach((c) => c.remove());

          function extractTextWithBreaks(element: Element): string {
            let out = "";
            for (const node of element.childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                out += (node.textContent || "").trim() + " ";
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = (node as HTMLElement).tagName.toLowerCase();
                const blockTags = [
                  "p",
                  "br",
                  "div",
                  "section",
                  "header",
                  "footer",
                ];
                const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"];
                const listTags = ["li"];

                if (headingTags.includes(tag)) out += "\n\n";
                if (blockTags.includes(tag)) out += "\n";
                if (listTags.includes(tag)) out += "- ";

                out += extractTextWithBreaks(node as Element);

                if (headingTags.includes(tag)) out += "\n\n";
                if (blockTags.includes(tag)) out += "\n";
              }
            }
            return out;
          }

          const images = Array.from(root.querySelectorAll("img"))
            .map((img) => ({
              src: img.src,
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
            }))
            .filter((i) => i.src && i.width && i.height);

          const nonDataImages = images.filter(
            (i) => !i.src.startsWith("data:")
          );
          const largest = nonDataImages.reduce(
            (max, img) => {
              const a = img.width * img.height;
              const b = max.width * max.height;
              return a > b ? img : max;
            },
            { src: "", width: 0, height: 0 }
          );

          return {
            text: extractTextWithBreaks(root).replace(/\s+\n/g, "\n").trim(),
            largestImageSrc: largest.src || null,
          };
        }) as Promise<EvalResult>,
        15000
      );

      text = res.text;
      largestImageSrc = res.largestImageSrc;
    } catch {
      throw new Error("EXTRACTION_FAILED");
    }

    // Determine restaurant name from home link or logo alt text.
    let restaurant: string = "";
    try {
      // Scan matching anchors in document order and pick the best candidate.
      const anchors = page.locator(
        `a[rel="home"], a[href="/"], a[href="${origin}"], a[href="${origin}/"]`
      );
      const count = await anchors.count();
      let firstAnchorText: string | null = null;
      let firstAnchorImgAlt: string | null = null;
      let matched: string | null = null;

      for (let i = 0; i < count; i++) {
        const a = anchors.nth(i);
        const aText = (await a.innerText())?.trim() ?? "";
        const img = a.locator("img, picture img").first();
        const imgCount = await img.count();
        const alt = imgCount
          ? (await img.getAttribute("alt"))?.trim() ?? ""
          : "";

        // capture first anchor values for later fallback
        if (i === 0) {
          firstAnchorText = aText;
          firstAnchorImgAlt = alt;
        }

        const aTextLower = aText.toLowerCase();
        const altLower = alt.toLowerCase();
        const found = restaurantKeywords.find(
          (kl) => aTextLower.includes(kl) || altLower.includes(kl)
        );
        if (found) {
          matched = aTextLower.includes(found) ? aText : alt;
          break;
        }
      }
      // Prefer a keyword match, then first anchor image alt, then first anchor text.
      restaurant = matched ?? firstAnchorImgAlt ?? firstAnchorText ?? "";
    } catch {
      restaurant = "";
    }
    // Remove variations of "Logo" from the detected restaurant name
    restaurant = restaurant.replace(/\blogo\b/gi, "").trim();
    if (restaurant) {
      restaurant = restaurant.charAt(0).toUpperCase() + restaurant.slice(1);
    }

    // Get base64 thumbnail for the chosen image (if any)
    let image_base64: string | null = null;
    if (largestImageSrc) {
      try {
        // Validate image src: allow data:image/*;base64 and http(s) only
        if (!isImageUrlSafe(largestImageSrc)) {
          largestImageSrc = null;
        } else if (largestImageSrc.startsWith("data:")) {
          const comma = largestImageSrc.indexOf(",");
          const raw =
            comma !== -1 ? largestImageSrc.slice(comma + 1) : largestImageSrc;
          if (isBase64ImageSafe(raw)) {
            image_base64 = raw;
          } else {
            // not base64 or too large
            largestImageSrc = null;
            image_base64 = null;
          }
        } else {
          const resolved = new URL(largestImageSrc, url).toString();
          if (!isImageUrlSafe(resolved)) {
            largestImageSrc = null;
          } else {
            const imgResp = await withTimeout(
              page.request.get(resolved) as Promise<APIResponse>,
              10000
            );
            if (imgResp.ok()) {
              const body = await imgResp.body();
              const b64 = Buffer.from(body).toString("base64");
              if (isBase64ImageSafe(b64)) {
                image_base64 = b64;
              } else {
                // too large or invalid
                image_base64 = null;
                largestImageSrc = null;
              }
            }
          }
        }
      } catch (err) {
        console.debug("image fetch failed", stringifyErr(err));
        image_base64 = null;
        largestImageSrc = null;
      }
    }

    return { text, image_url: largestImageSrc, image_base64, restaurant };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "NAVIGATION_FAILED" ||
        err.message === "EXTRACTION_FAILED")
    )
      throw err;
    console.error("getMainSection failed", stringifyErr(err));
    return defaultResult();
  } finally {
    if (page) await safeClose(page, "page");
    if (context) await safeClose(context, "context");
    if (browser) await safeClose(browser, "browser");
  }
  function stringifyErr(err: unknown) {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err)
      return String((err as { message?: unknown }).message ?? "");
    return String(err);
  }
}
