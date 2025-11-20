import {
  enforceRateLimit,
  getClientIp,
  _clearRateLimitStore,
} from "../security";

afterEach(() => {
  _clearRateLimitStore();
});

test("allows up to 5 requests per minute and blocks the 6th", () => {
  const ip = "1.2.3.4";
  // 5 allowed
  for (let i = 0; i < 5; i++) {
    expect(() => enforceRateLimit(ip)).not.toThrow();
  }
  // 6th should throw
  expect(() => enforceRateLimit(ip)).toThrow("RATE_LIMIT_EXCEEDED");
});

test("getClientIp extracts first value from x-forwarded-for header", () => {
  const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" });
  expect(getClientIp(headers)).toBe("9.9.9.9");
});

test("getClientIp returns null when no header present", () => {
  const headers = new Headers();
  expect(getClientIp(headers)).toBeNull();
});
