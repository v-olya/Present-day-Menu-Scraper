import { execSync } from "child_process";

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

try {
  // Explicit opt-out from browser download
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
    console.log(
      "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 detected — No browser download"
    );
    process.exit(0);
  }

  const platform = process.platform;
  const browsersEnv = process.env.PLAYWRIGHT_BROWSERS;

  // Default to Chromium only unless the developer opts-in to others
  const defaultBrowsers = "chromium";
  const browsers = browsersEnv
    ? browsersEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ")
    : defaultBrowsers;

  // ON Linux, it's preferable to run --with-deps, btu this atempt may fail if not running as root
  if (platform === "linux") {
    const isRoot =
      typeof process.getuid === "function" && process.getuid() === 0;
    if (isRoot) {
      const cmd = browsers
        ? `npx playwright install --with-deps ${browsers}`
        : "npx playwright install --with-deps";
      run(cmd);
    } else {
      const cmd = browsers
        ? `npx playwright install ${browsers}`
        : "npx playwright install";
      run(cmd);
      console.log(
        "Note: not running `--with-deps` because the process is not running as root."
      );
      console.log(
        "If browsers fail to launch, re-run as root or install the OS packages manually:"
      );
      console.log("sudo npx playwright install --with-deps");
    }
  } else {
    const cmd = browsers
      ? `npx playwright install ${browsers}`
      : "npx playwright install";
    run(cmd);
  }

  console.log("Playwright browser binaries installed.");
} catch (err) {
  console.error(
    "Failed to install Playwright browsers:",
    err && err.message ? err.message : err
  );
  process.exitCode = 1; // Node exits naturally so stdout/stderr can flush
}
