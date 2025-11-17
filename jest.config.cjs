const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Path to load next.config.js and .env files from
  dir: "./",
});

const customJestConfig = {
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: ["app/**/*.{js,jsx,ts,tsx}", "!app/**/*.d.ts"],
  fakeTimers: {
    enableGlobally: true,
    legacyFakeTimers: true,
  },
};

module.exports = createJestConfig(customJestConfig);
