## About the project

This repository is a Next.js prototype that extracts and normalizes restaurant menu data from restaurant websites. It's intended for experimentation and local development only, not for production.

How it works:

- Scrape with Playwright: `app/helpers/scraper.ts` uses Chromium to load a page, dismiss overlays/cookie banners, extract readable text from the main content, and locate the largest non-data: image URL.
- Parse with LLM: `app/helpers/openai.ts` sends the cleaned page text (and `image_url` when available) to OpenAI Chat Completions with a strict JSON Schema response format. The code validates the returned JSON with `ajv` and surfaces structured `menu_items`, `restaurant_name`, `date`, `reason`, and `rationale`. In development mode, the scrapped text and model's output are shown in <RawDetails> components.
- DB & polling: `db/db_manager.ts` stores parsed responses in a SQLite DB (`cb/responses.db`), schedules hourly polling for registered URLs, computes content hashes to detect changes, and pushes new menus into the cache. A midnight cron job removes stale entries.
- `app/menu/route.ts` exposes a POST endpoint that accepts a `url`, runs scraping + LLM parsing, and returns parsed results (or starts polling if no menu detected). The LLM is expected to return strictly structured JSON; `ajv` validation rejects deviating outputs and surfaces an error.
- `app/db/route.ts` provides GET/POST helpers to retrieve or insert cached responses. Polling is conservative: when parsing fails, the URL is inserted into a `polling` table and rechecked hourly; new menus trigger notifications and insertion into the `cache` table.
- Notifications: When a new menu is detected, the code post a webhook to `DISCORD_WEBHOOK_URL` (if set).

### Key environment variables

- `OPENAI_API_KEY` — required for LLM parsing.
- `DISCORD_WEBHOOK_URL` — optional; used to notify on new menus.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` — optional; set it to `1` to skip downloading Playwright browsers after `npm install`.
- `PLAYWRIGHT_BROWSERS` — optional; comma-separated list to control which browsers to install via the helper script.

### Run / test

- Install: `npm install` (the repo's `postinstall` runs `scripts/install-playwright.mjs` unless skipped).
- Dev: `npm run dev`.
- Tests: `npm test` (Jest).

#### Playwright Installation\*\*

- **What runs on `npm install`:** this repo runs the helper `scripts/install-playwright.mjs` as a `postinstall` script which downloads Playwright browser binaries (Chromium by default).
- **Skip download:** set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to skip browser downloads during `npm install` (only do this if browsers are provided by your image, cache, or provisioning process).
- **Install specific browsers:** set `PLAYWRIGHT_BROWSERS='chromium,firefox'` before running `npm run playwright:install` to install only the listed browsers.
- **Linux system deps:** on Linux the helper attempts `--with-deps` only when running as root; otherwise it installs binaries only and prints guidance to run `sudo npx playwright install --with-deps` if needed.

CI / Docker notes:

- For CI prefer using Playwright's official Docker images which include deps, or run `sudo npx playwright install --with-deps`.
- To speed up installs, set a shared `PLAYWRIGHT_BROWSERS_PATH` and cache that directory in CI.

Caching `PLAYWRIGHT_BROWSERS_PATH`:

- Playwright stores browser binaries in the per-user cache by default (`%LOCALAPPDATA%\ms-playwright` on Windows or `$HOME/.cache/ms-playwright` on Linux). You can set `PLAYWRIGHT_BROWSERS_PATH` to a path you cache between CI runs to avoid repeated downloads.

Example (GitHub Actions cache step):

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-browsers-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
```

If you want, you can change this project to remove the helper and use a direct installation instead.

**NOTES**

- Initial page scrapping is slowed down by converting the largest image found to base64 format in order to display it in the UI. This is not necessary and can be avoided.
- In `const.ts`, there are restaurantURLs with menu URLs to try (and the reasons why to try).
