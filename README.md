## About the project

This repository is a Next.js prototype that extracts and normalizes restaurant menu data from restaurant websites. It's intended for experimentation and local development only, not for production.

How it works:

- Scrape with Playwright: `app/helpers/scraper.ts` uses Chromium to load a page, dismiss overlays/cookie banners, extract readable text from the main content, and locate the largest non-data: image URL.
- Parse with LLM: `app/helpers/llm.ts` sends the cleaned page text (and `image_url` when available) to OpenAI Chat Completions with a strict JSON Schema response format. The code validates the returned JSON with `ajv` and surfaces structured `menu_items`, `restaurant_name`, `date`, `reason`, and `rationale`. In development mode, the scrapped text and model's output are shown in <RawDetails> components.
- Cache & polling: `cache/db_manager.ts` stores parsed responses in a SQLite DB (`db/responses.db`), schedules hourly polling for registered URLs, computes content hashes to detect changes, and pushes new menus into the cache. A midnight cron job removes stale entries.
- `app/menu/route.ts` exposes a POST endpoint that accepts a `url`, runs scraping + LLM parsing, and returns parsed results (or starts polling if no menu detected). The LLM is expected to return strictly structured JSON; `ajv` validation rejects deviating outputs and surfaces an error.
- `app/cache/route.ts` provides GET/POST helpers to retrieve or insert cached responses. Polling is conservative: when parsing fails, the URL is inserted into a `polling` table and rechecked hourly; new menus trigger notifications and insertion into the `cache` table.
- `app/cache-scraper-proxy/route.ts` implements a proxy that first checks the local cache for an existing parsed menu for a given `url`. If a cached menu is found it returns that immediately. If not, it forwards the request to the heavy `POST /menu` scraper-parsing route, returns the scraper's result to the client, and stores it in the cache for subsequent responses. This proxy is useful for clients that want a single endpoint to read-from-cache-or-scrape-with-caching without calling `/cache` and `/menu` separately.
- Notifications: When a new menu is detected, the code post a webhook to `DISCORD_WEBHOOK_URL` (if set).

### Key environment variables

- `OPENAI_API_KEY` — required for LLM parsing.
- `INTERNAL_API_SECRET` — required. The heavy scraper route `POST /menu` requires requests to include the header `x-internal-secret` with this exact value. This protects the Playwright-based scraper from public access.
- `DISCORD_WEBHOOK_URL` — optional; used to notify on new menus.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` — optional; `1` to skip downloading browsers after `npm install`.
- `PLAYWRIGHT_BROWSERS` — optional; comma-separated list to control which browsers to install via the helper script.

### Run / test

- Install: `npm install` (the repo's `postinstall` runs `scripts/install-playwright.mjs` unless skipped).
- Dev: `npm run dev`.
- Tests: `npm test` (Jest).

#### Playwright Installation

- **What runs on `npm install`:** this repo runs the helper `scripts/install-playwright.mjs` as a `postinstall` script which downloads Playwright browser binaries (Chromium only by default).
- **Skip download:** set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to skip browser downloads during `npm install` (only do this if browsers are provided by your image, cache, or provisioning process).
- **Install specific browsers:** set `PLAYWRIGHT_BROWSERS='chromium,firefox'` before running `npm run playwright:install` to install only the listed browsers.
- **Linux system deps:** on Linux the helper attempts `--with-deps` only when running as root; otherwise it installs binaries only and prints guidance to run `sudo npx playwright install --with-deps` if needed.

If you want, you can change this project to remove the helper and use a direct installation instead.

### Notes

- In `const.ts`, there are restaurantURLs with different menu URLs to try (and the reasons why to try).
- Initial page scrapping is slowed down by converting the largest image found to base64 format in order to just display it in the UI. This is not necessary and can be avoided.
- On FE, the only indicator that data is being read from the cache is the absence of <RawDetails> with _Playwright output_, _LLM output_, and _model rationale_.
- Besides the routes mentioned above, there is also the `/api/db-viewer/db` route. It's just a handy tool for viewing the data we already have in `cache` and `polling` tables. It's dev-only.
