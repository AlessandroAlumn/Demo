import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// A small server (Render's free plan has 512 MB) cannot afford Next's default of one build worker per CPU core:
// on this app that peaked at about 2.4 GB. LOW_MEMORY_BUILD=1 (set in render.yaml) builds with a single worker.
const lowMemoryBuild = process.env.LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  // The type check (npm run typecheck) is what takes the extra memory at build time; skip it only in the small-server build.
  typescript: { ignoreBuildErrors: lowMemoryBuild },
  experimental: {
    // The admin CSV upload goes through a server action: the default 1MB limit is too small for real exports.
    serverActions: { bodySizeLimit: "25mb" },
    ...(lowMemoryBuild ? { cpus: 1 } : {}),
  },
};

export default withNextIntl(nextConfig);
