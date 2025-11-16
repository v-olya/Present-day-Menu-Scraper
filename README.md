**Playwright Installation**

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
