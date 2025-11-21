import type { NextConfig } from "next";

// Enforce presence of INTERNAL_API_SECRET in non-test environments
if (
  (!process.env.OPENAI_API_KEY || !process.env.INTERNAL_API_SECRET) &&
  process.env.NODE_ENV !== "test"
) {
  throw new Error(
    "INTERNAL_API_SECRET environment variable is required. Set it before starting the server."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
