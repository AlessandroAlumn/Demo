# Decisions log

Choices made while building, where PLAN.md was silent or reality differed.

## Step 1: Scaffold

- **Project name:** the folder is `ApplumnUSB` (capitals), which npm rejects. The package is named `alumnusb-gamification`. The scaffold was generated in a scratch folder and copied in.
- **Next.js 16.4.2** (latest stable) is "not the Next.js you know" (see AGENTS.md).
  - `middleware.ts` is now `proxy.ts`. The next-intl middleware lives in `src/proxy.ts`.
  - `create-next-app` enabled `cacheComponents` and `partialPrefetching`. **Disabled.** The app is per-user and dynamic (cookie sessions, DB reads), so static-shell caching adds friction and no benefit.
  - Kept the scaffold's `turbopack.rules` entry for `*.css` (the `@tailwindcss/turbopack` loader). There is no PostCSS config, and without the rule `@theme` is not processed.
  - Page props use the global `PageProps<"/[locale]">` and `LayoutProps<"/[locale]">` helpers.
- **Prisma pinned to 6.19.3** (client and CLI). `prisma@latest` is 8.0 release candidate; 7.x requires driver adapters and extra config. 6.x runs SQLite directly. Everything the plan needs works the same.
- **Vitest 5**, `tsx` for scripts, `papaparse` for CSV.

## Theme (source: alumnusb.org Elementor global kit, `wp-content/uploads/elementor/css/post-19.css`)

| Token | Hex | Kit name |
|---|---|---|
| brand-yellow | `#F9CF00` | primary |
| brand-blue | `#0050B4` | secondary |
| brand-black | `#111111` | accent |
| brand-text | `#1C1C1C` | text |
| brand-yellow-soft | `#FDF5CC` | custom color |
| grays | `#FCFCFD #EAECF0 #D0D5DD #98A2B3 #667085 #475467 #0C111D` | custom colors |

- **Fonts:** headings **PT Serif** 700, body **Roboto** 300/400, accents (buttons, labels) **Inter** 600. All three are on Google Fonts and loaded through `next/font/google`.
- **Logos** are in `public/brand/`: `logo-white.png` (header, 300×94), `logo-white-full.png` (613×192) and `logo.png` (dark logo for light backgrounds, 1024×321).
- Tier colors (bronze, silver, platinum, diamond) are my own picks. The site has none. Gold reuses brand yellow.
- The header is black with the white logo, like the main site.
