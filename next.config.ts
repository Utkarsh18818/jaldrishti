import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  output: "standalone",
  outputFileTracingExcludes: { "/*": [".env", ".env.*", ".aws-local/**/*", ".cache/**/*", "artifacts/**/*"] },
};
export default config;
