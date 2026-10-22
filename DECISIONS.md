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

## Step 2: Schema

- **Date-only fields are ISO strings** (`"2026-07-01"`), not `DateTime`. They sort as text and the simulated "today" never shifts with the host timezone.
- **Enum-like columns are plain strings.** The allowed values are in `src/lib/constants.ts`, and the importer validates them.
- **Badge count is 50** (not 44 as first said in chat): the spec has 50 `B-*` rows and 31 `N*` rows. `src/lib/badge-definitions.ts` holds all 50 with machine-readable `rule` JSON. A Vitest test fails if its IDs differ from `BADGES_AND_NOTIFICATIONS.md`.
- **Badge texts with placeholders:** `B-P9` ("Campaign Hero: {campaign}") and `B-G1` ("Double Impact {year}") keep the `{campaign}` / `{year}` tokens in the stored name. The UI substitutes the award's `periodKey`.
- **Seed is idempotent and non-destructive.** It inserts only missing settings and badges, so edits made in the backoffice survive a re-seed.
- **Users are not seeded yet.** They need the donors from the importer (step 4) and are created in step 5.
- **Extra columns beyond PLAN.md section 6:**
  - `Donor.referredBy` and `User.referralCode` (referral badges);
  - `Notification.seq` (stable order within a simulated day);
  - `BadgeDefinition.sortOrder`;
  - `BadgeAward.periodKey` defaults to `""` for one-off badges, so the unique key works in SQLite (NULLs are treated as distinct there).
- **Vitest config is `vitest.config.mts`** because the project is CommonJS.

## Step 3: Mock data

- **Output:** `data/donations.csv` (~25.7K rows), `data/subscriptions.csv` (~900), `data/companies.json` (50). Deterministic (seed `20260701`), committed to git. Regenerate with `npm run generate-data`; `npm run data:stats` prints the calibration report.
- **Donors: 2,525** = 20 personas (`D0001`–`D0020`) + 2,500 background (`D0021`–`D2520`) + 5 donors that User14 refers (`D2521`–`D2525`).
- **Personas are named `User1`…`User20`** with emails `userN@demo.alumnusb.test`. Background donors have anonymous Latin-American mock names at `@example.org`.
- **Calibration** (tuned with `data:stats`, locked in by tests):
  - about $957K raised before launch, close to the ~$945K the real site reports;
  - the $1M mark is crossed on 2026-08-11, inside the demo window (N30);
  - 630–810 donors give in each demo month (target 600–900);
  - about 480 recurring subscriptions are active at launch.
  - Levers: `FIRST_GIFT_SKEW`, `ONE_TIME_SCALE`, `RECURRING_SHARE`, `REPEAT_PROBABILITY` in `scripts/generate-mock-data.ts`.
- **Background gifts are capped at $1,000** and background recurring plans top out at $250/month, so persona-sized gifts win Donor of the Week/Month. User1 wins July, August, October and December; User7 wins September. No background donor has a $500/month plan, so Diamond Recurring is only ever User1.
- **Annual plans** are capped at $50/month equivalent ($600/year). A $250/month plan billed yearly would be a $3,000 charge.
- **User14 refers 5 donors, not 2** (PLAN.md section 5 said 2), so both Recruiter (first referral, Aug) and Super Recruiter (5th, Dec) are demonstrable.
- **Subscription changes are modelled as two subscriptions.** User4 reactivates as a *new* $100 plan and User9 raises $45 to $50 as a *new* plan; the old ones get an `end_date`. Streaks and tiers are per donor, not per subscription.
- **Failed cards in the background data:** failed charge rows; 40% are fixed within a few days, 20% later, 40% never. Never-fixed ones leave the subscription `failed` (feeds the at-risk list).
- **Subscription `status` in the CSV** is derived from the rows at the end of the data (2026-12-31), informational only. The app recomputes status "as of" the simulated date.
- **Matching gifts:** about 3% of donors get a `matching_gift` row 7–30 days after a one-time gift, in about 80% of the years they gave since 2019.
- **Companies are fictional** ("Orinoco Tech", …) on purpose: no claims about real employers' matching programs.
- **Not produced by data (simulated later by `verify-coverage`, step 8):** badges that need UI actions: social follows (SO1–SO6, claim then admin approval), Proud Supporter (a share), Early Adopter (first login), plus notifications N24/N25 (claim review) and N31 (first login).
- **Open point for step 7:** a period "closes" when `asOf` reaches its last day, so the December and 2026 year-close items fire on 2026-12-31 (the end of the demo range).

## Step 4: Importer

- **`src/lib/importer.ts`** is the single implementation behind `npm run import` and the backoffice upload (step 11). `runImport(db, { donationsCsv?, subscriptionsCsv? }, { dryRun })` returns a report with new / updated / unchanged counts, row-numbered issues and donor counts. A dry run writes nothing; the backoffice preview calls it with `dryRun: true`, then again for the confirm.
- **Donations are upserted by `donation_id`; subscriptions are replaced entirely**, as planned. A subscriptions-only or donations-only upload works.
- **Invalid rows are skipped, not fatal.** The valid rows still import and the report lists each problem with its CSV line number and field. The CLI exits with code 1 if there were any problems, so scripts notice.
- **Donor fields are derived, not trusted from one file.**
  - Name and email come from the donor's latest donation row.
  - `firstDonationDate` is the earliest *succeeded* donation (all rows if none succeeded), combined with what is already in the DB, so a "newest rows only" file never moves a donor's first gift forward.
  - `referredBy` comes from the earliest row that carries one.
- **Everything runs in one transaction** (donors, donations, then subscriptions), so a crash leaves the previous data intact.
- **Tests use a throwaway SQLite file** built from the real migration SQL (`prisma/migrations/*`), never the dev DB. One test imports the full generated mock data twice and asserts the second run changes nothing.
- **Dry-run donor counts are an estimate** (computed from file + DB before writing). Differences from the real run are possible only if an *updated* row moves a donor's earliest date.
- `npm run setup` now runs the import after the seed.

## Step 5: Login and sessions

- **Accounts:** `scripts/seed-users.ts` (`npm run seed:users`, also run by `npm run setup`) creates `admin` and `User1`…`User20` linked to donors `D0001`…`D0020`, each with referral code `USERn`. It refuses to run if the donors are missing (run the import first). It also gives User15 the Ambassador badge as a *manual* award, which "Reset demo" will keep.
- **No passwords.** The password input exists but the server action never reads it; the page says so. Login names match case-insensitively and ignore surrounding spaces (`" user10 "` works).
- **Session = signed cookie** (`alumnusb_session`): `base64url(JSON{uid, role, exp}).HMAC-SHA256`, built on Node's `crypto` (no JWT dependency). HttpOnly, SameSite=Lax, 7 days, `Secure` only in production. Verified with `timingSafeEqual`. `SESSION_SECRET` comes from `.env` (16+ chars); a dev-only fallback is used if it is missing and **production refuses to start without one**.
- **Guards, in two layers.** `src/proxy.ts` is an optimistic check (no cookie, no pages except `/login`). The real check is `getCurrentUser()` in the `(app)` layout: it verifies the signature, re-reads the user from the DB and compares the role, so a forged cookie or one left from a re-seeded database is rejected. `/admin` additionally requires `role = admin`; a donor who types the URL goes to their dashboard, and an admin opening `/dashboard` goes to `/admin`.
- **`redirectTo(href, locale)`** in `src/i18n/navigation.ts` wraps next-intl's `redirect` (typed `void`) as `never`, so `if (!user) redirectTo(...)` narrows the type.
- **`User.firstLoginAt`** is set to the simulated date on first login. The Welcome notification (N31) and the Early Adopter badge (B-X2) will be derived from it in steps 7-8.
- **The header** now shows the real simulated date (`getToday()`), the user, nav and a sign-out button. The home page `/[locale]` only redirects (login, dashboard or admin).
- **Dashboard and admin pages are placeholders** (donor id, first donation, demo date) until steps 9 and 11.
- **Verified over HTTP against the running dev server:** logged-out redirects, form-POST login for donor and admin (303 to the right place), unknown/empty username errors in Spanish, role guards both ways, forged cookie rejected with no redirect loop, logout clears the cookie.
