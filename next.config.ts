import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The admin CSV upload goes through a server action: the default 1MB limit is too small for real exports.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // Tailwind v4 is wired in through its Turbopack loader (no PostCSS config).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
