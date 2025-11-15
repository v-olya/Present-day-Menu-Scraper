import { chromium } from "playwright";
import { ParseResult } from "./types";

export async function getMainSection(url: string): Promise<ParseResult> {
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

  let image_base64: string | null = null;
  if (largestImageSrc) {
    try {
      const imageResponse = await page.goto(largestImageSrc);
      const buffer = await imageResponse?.body();
      image_base64 = (buffer ?? "").toString("base64");
    } catch {
      image_base64 = null;
    }
  }

  await browser.close();
  return { text, image_url: largestImageSrc, image_base64 };
}
