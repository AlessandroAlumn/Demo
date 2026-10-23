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

## Step 6: Engine (subscriptions, points, rankings)

Pure functions in `src/lib/engine/`; no Prisma, no real clock. The pipeline (step 8) loads rows into `DonationRec` / `SubscriptionRec` / `EngagementEvent` and passes an explicit `asOf`. Date helpers moved to `src/lib/dates.ts` (the mock-data scripts re-export them).

- **Subscription status as of a date** (`subscriptions.ts`): `cancelled` (end date reached) → `active` → `grace` → `inactive`, or `not_started`. Healthy means the latest charge succeeded *and* there is a success inside the window (35 days monthly, 370 annual). The grace period starts on the first failed charge since the last success, or, with no failed row, the day the window runs out. `graceDaysLeft` is 7 on the failure day, 1 on day 6 and 0 (inactive) on day 7, so User4 (fails Aug 3) expires Aug 10, and a "2 days left" nudge fires on day 5.
- **Streak** = consecutive calendar months covered by a successful recurring charge, per donor (so a plan change keeps it). Rules worth knowing:
  - Counted months end this month if its charge has landed, else last month (the charge just hasn't happened yet).
  - A retry that succeeds inside grace also covers the month that failed.
  - A failure still in grace *bridges* its month: the streak survives but is not inflated.
  - When grace expires unfixed, the earlier months are wiped, and a late fix starts again at 1. My first version counted the failed month as covered, which inflated the streak by one; the bridge set fixes that.
  - Annual plans cover 12 months from the charge.
- **Current monthly amount** sums active *and in-grace* subscriptions (the tier is at risk, not gone), annual ÷ 12. Inactive and cancelled ones don't count, so User4 drops from Silver to no tier on Aug 10.
- **Impact Points** (`points.ts`) are computed per calendar month per donor, so the caps apply per month and yearly / all-time are sums. The streak bonus uses the streak *as of the end of that month* (or `asOf`), and only in months with a successful recurring charge. Engagement is +5 per event, max 20 per month; a referral is an event for the referrer on the referred donor's first succeeded donation (`referralEvents`). Weights come from settings (`EngineSettings`).
- **Rankings** (`rankings.ts`): eligible = a succeeded donation inside the period; order by points, then earliest first donation in the period, then donor id, so positions are unique and deterministic. `topPercent = ceil(rank/total × 100)` (#258 of 2,500 → Top 11%). `gapToNext` gives the points gap and the smallest whole-dollar one-time gift that *strictly* passes it (`floor(gap / weight) + 1`; a tie is lost by the later donor). Opted-out donors are still ranked.
- **Period closing:** `monthPeriod(ym)` and `yearPeriod(y)` cover a whole period (for winners at close); `currentPeriod(ranking, asOf)` is the live one.
- **Performance (note for step 8):** one `computeRankings` for all three rankings over 2,525 donors takes about 430 ms, almost all of it recomputing monthly points. Stepping day by day, a +1 month jump would take about 12 s, a little over the 10 s target. Completed months never change, so step 8 should cache each donor's points for closed months and only recompute the current one. The API already allows it (`computeAllMonthlyPoints` returns per-donor month maps).
- **Persona checks live in tests** (`personas.test.ts`, on the generated data): User2's 24-month streak lands Aug 10; User3 is in grace Jul 15-18 and active Jul 19 with the streak kept; User4 goes inactive on Aug 10 with streak 0 and restarts at $100/Gold on Oct 5; User9 is $5 short of Silver until October; User1 Diamond, User7 Platinum, User19 Silver; User1 is #1 monthly in July, August, October and December and User7 in September; Users 17 and 18 swap the lead at least 5 times in July.
- Also: `isoWeekKey()` (Monday-Sunday) is in `dates.ts` for Donor of the Week (step 7), and `previousDay()` for comparing against yesterday's snapshot (step 8).

## Step 7: Badge engine

`src/lib/engine/badges.ts`. `evaluateBadges(input, day)` returns every award that *holds* on a day: state badges (cumulative) plus the period winners that close that day. Pure; the pipeline (step 8) evaluates each day, inserts the candidates whose key `(donorId, badgeId, periodKey)` is not stored yet, and notifies for the new ones. Badges are never removed.

- **State badges** are computed from `DonorFacts` (lifetime total, giving years, first date per program and campaign, matched gifts per year, recurring summary, referrals, approved follows, shares, comebacks) as of the day. `awardedAt` is the real date where it is knowable (first gift, the gift that crosses a club, the first gift of the Nth year, the first gift to a program, the matched gift, the referred donor's first gift, the claim's review date). Tier and streak badges use the evaluation day, since they are derived from the current state. At launch day everything already earned is awarded silently with those dates (step 8 sends no notifications for the baseline).
- **Period winners fire only on the closing day:** Donor of the Week on the Sunday that ends an ISO week (Monday-Sunday), the month badges on the last day of the month, Yearly Top 10 on 31 December. Weekly and monthly winners are decided by **dollars** (all succeeded rows, ties: earliest gift, then donor id); Top 10 / Top 10% use the Impact Points ranking of the closed month (`topPercent <= 10`); Yearly Top 10 uses the closed year's ranking.
- **`eventsFrom` (the launch date):** purely date-driven repeatable badges (week/month/year winners, anniversaries) are only produced from that date, so launching doesn't invent hundreds of past winners and anniversaries. Fact-based repeatables (Double Impact per year, Campaign Hero per campaign) include history because it is bounded.
- **Matched gifts count towards the lifetime total** (and clubs) as well as towards the weekly/monthly dollar totals.
- **Biggest Climber:** all-time rank at the end of the previous month vs the end of this month, among donors ranked at both ends; the largest gain wins (ties: better final rank). No award if nobody climbed.
- **Back in the Game** (`reactivationDates` in `subscriptions.ts`): a failure that was not fixed inside grace, or a cancellation followed by more than 35 days with no recurring charge, then the first successful recurring charge. A failure fixed inside grace (User3) and a plan change where the new plan charges the same day the old one ends (User9) do **not** count. A first version counted fixed failures; the test caught it.
- **Early Adopter** reads `firstLogins` (donor -> simulated date of the user's first login) and requires the login within `earlyAdopterDays` of launch. Social follows read approved `SocialClaim` rows, Proud Supporter reads `ShareEvent` rows. **Data alone produces 41 of the 50 badges** during the demo; the 9 that cannot come from the CSVs (6 social-follow badges, Proud Supporter, Early Adopter, and the manual Ambassador) are asserted by a test and will be exercised by `verify-coverage` in step 8, which simulates the claims, share and first login.
- **Also here:** `badgeProgress` (the "$180 / $250" bars for lifetime, streak, years, tier, referrals, Full Spectrum, matching streak, follows), `nearLifetimeBadges` (the N3 "within 10%" check), `badgeRarity` (share of donors holding each badge, one decimal), `createRankingSource` (month/year/all-time rankings with a small cache, shared by the pipeline for snapshots).
- **Speed:** a full state evaluation of 2,525 donors for one day takes about 40 ms (16K awards at the end of the year), so the per-day cost of the pipeline is dominated by the rankings, not the badges.

## Step 8: Notifications, pipeline and time machine

**Files:** `src/lib/pipeline.ts` (day loop, time machine, reset, refresh), `src/lib/engine/notifications.ts` (pure detectors), `src/lib/notification-types.ts` (N1-N31 registry), `src/lib/demo-actions.ts` (first login, claim, review, share), `src/lib/seeding.ts` (shared by the scripts and tests), `scripts/demo.ts`, `scripts/verify-coverage.ts`, `scripts/inspect.ts`.

- **The baseline day.** The first day processed is the launch date (2026-07-01). It stores every badge already earned (about 12,900, with their real dates) and the rank snapshots **silently**: no notifications, otherwise day one would flood everyone. `lastProcessedDate = ""` means "nothing processed yet". `npm run setup` runs `demo -- reset`, which processes it.
- **Everything is idempotent.** Awards are unique on `(donor, badge, period)`, notifications on a dedupe key, snapshots per donor/ranking. Re-processing a day or `refreshToday` stores only what is new. A refresh on the launch day behaves like a normal day, so the first login of the demo also gives everyone the launch-day nudges (new month, gap to next position).
- **One pipeline job at a time** (in-process queue), so a double click on the time machine cannot interleave two runs.
- **Speed.** Closed months are cached per donor (`PointsCache`; only the current month is recomputed each day). Baseline ~1 s, a 30-day jump ~5 s, the whole demo (176 days) ~30 s. The cache returns shared maps that the next call in the same month mutates; the test `rankings stored by the cached pipeline equal a from-scratch recomputation` guards that.
- **The demo ends 2026-12-31** (`DEMO_END_DATE`, the end of the generated data); `processUntil` clamps to it. Year-close items (N8, Yearly Top 10) fire on that last day.
- **Snapshots only for users (User1-20).** `RankSnapshot` rows exist per user donor and ranking, not for all 2,525 donors; the backoffice ranking pages (step 11) compute the full tables live from the engine. Month-start all-time snapshots are not stored: Biggest Climber recomputes the two all-time rankings. The snapshot also feeds the dashboard rank cards (step 9).
- **"Someone passed you" is throttled (a deviation from "every position", please confirm).** With 2,500 donors giving every day, an unthrottled N5 produced about 620 notifications in July (User17: 89 in a month, 5 of every 6 were "down"). Moving **up** still notifies on any change, even one position. Moving **down** is now one digest per ranking per `rankDownCooldownDays` (default **7**), comparing with the last rank the donor was told about ("#100 → #105"). Set it to 0 for every position. Effect: July went from 838 to 418 notifications.
- **Notification grouping:** several recurring tiers earned together are one **N16** for the highest tier; several money clubs the same day are one N1 for the highest club; Donor of the Week/Month use **N9** (with the amount), Biggest Climber **N10** (with the gain), anniversaries **N20** (with the years). Double Impact is announced by **N22**, social follows by **N24** and Recruiter by **N26**, so those badges get no extra N1. N2 (the share prompt) lives inside N1 in the UI and is never stored.
- **Other notification rules:** N12 on the first failure, N13 when 2 days or fewer of grace are left (once per failure), N14 when grace expires, N15 when payment is back (`streakRestored` is true only if it was fixed inside grace). N17 fires once per target tier when within 10% (so User9 at $45 gets it the day after launch); N3 once per badge within 10%. N19 uses the first impact equivalence ($300 = a month of a scholarship, a placeholder) each time the lifetime total crosses another multiple. N21 once per lapse, N23 on 09-01, N11 on the 1st, N7 on the last day of a month. N27/N28/N29/N30 go to every user: campaign progress at 50/75/100% of the goal and an "ending soon" reminder 5 days before the end (the demo goal is $9,500, tuned to the mock data), organisation milestones at $250K, $500K, $750K, $1M, $1.25M…. Opted-out users get no notifications.
- **State-based nudges after the baseline fire on the *next* day** (N3 for User8, N17 for User9, N21 for User10 land on 07-02), because the baseline day emits nothing.
- **Time machine functions:** `processUntil`, `advanceDays`, `advanceMonths`, `refreshToday`, `resetDemo`, `getDemoState`; CLI `npm run demo -- status | reset | advance --days N | --months N | --to DATE`. `resetDemo` deletes notifications, snapshots, claims, shares and automatic awards, clears `firstLoginAt`, and keeps manual awards and posts.
- **UI actions** (`demo-actions.ts`) are the same functions the screens will call in steps 10-11: `recordFirstLogin` (already used by the login action), `submitSocialClaim`, `reviewSocialClaim`, `recordShare`. Each stamps the simulated date and, by default, refreshes today so the result is visible immediately.
- **`npm run verify-coverage`** runs the whole demo on a **temporary copy** of the dev database (your demo state is untouched), simulates the UI actions on the way (a first login, a share, five approved follows, one rejected), and fails if any badge or notification type is missing. Result: **50/50 badges and 30/30 stored notification types** (all but the UI-only N2), about 30 s.
- **Tests added:** detectors (21), the end-to-end pipeline on a temporary DB (19: baseline, idempotency, persona timelines, cache = recompute, throttle, UI actions, +1 month speed, end clamp, reset and deterministic replay). Suite: 197 tests.

## Scale change: 500 donors (after step 8)

The mock data was cut from 2,525 donors to **500**, to keep the demo simple. This supersedes the numbers in the step 3, 6 and 8 notes above.

- **Donors: 500** = 20 personas (`D0001`-`D0020`) + 475 background (`D0021`-`D0495`) + the 5 donors User14 refers (now `D0496`-`D0500`). About 5,000 donation rows and 182 subscriptions. One constant (`BACKGROUND_DONORS`) controls it.
- **Persona timelines are unchanged** (they are hand-built). Active donors per month are about 130-170 in the demo window, so ranks read like "#52 of 145" instead of "#258 of 2,500", and Top 10% means about 15 donors.
- **Money:** about $180K raised before launch and $231K by the end of December (it was ~$957K / $1.17M; the real site reports ~$945K, so the mock no longer matches it). Gift sizes were not scaled up, to keep the persona stories (a $2,000 gift winning Donor of the Month) intact.
- **Organisation milestones are now a setting** (`orgMilestones`, default $150K, $200K, $225K, $250K), because they depend on the dataset. The demo crosses $200K on Sep 9 and $225K on Dec 13 (N30). The campaign goal is now **$1,800** (about $1,650 is raised): 50% in August, 75% in October, and the "ending soon" reminder on Dec 26.
- **Existing databases must be rebuilt**: the importer upserts and never deletes, so re-importing a smaller file leaves old donors behind. `rm prisma/dev.db && npm run setup` rebuilds it (tested).
- **Effects:** the whole demo runs in ~9 s (was ~32 s), the baseline in 0.2 s, the test suite in ~12 s (was ~41 s). Coverage is still 50/50 badges and 30/30 stored notification types.
- **Heads-up:** with fewer donors, neighbours in the ranking are closer in points, so the standalone "you're only $X from #N" nudge (N6) fires often (about 46 per user over six months with the 7-day cooldown). `gapNudgeThresholdUsd` and `gapNudgeCooldownDays` tune it.

## Step 9: Donor screens

- **Pages:** `/dashboard` (payment banner, totals, 3 rank cards, recurring card, impact, recent badges, latest activity), `/donations` (totals, by program, history table), `/badges` (50 badges by category) and `/badges/[id]` (detail), `/feed` (all notifications, mark one / all as read). The header has the nav, the bell (unread count, latest 8, mark all read) and a sign-out button. Layout is mobile-first (single column on a phone, checked in screenshots).
- **Rank cards read the snapshots, not the engine.** `RankSnapshot` gained two columns (migration `rank_snapshot_gap`): `gapDollars` (the "only $X to reach #N" line) and `prevRank` (the ▲/▼ arrow: positions gained or lost at the last change inside the period). The dashboard therefore needs no ranking computation per request. A ranking with no snapshot for the *current* period (e.g. no donation yet this month) shows "Donate this month to enter the ranking".
- **Notifications are rendered at view time** by `render-notification.ts` from `type + params`, in the viewer's language (ICU plurals; a test renders all 30 stored types in both languages and fails on a missing key, and another fails if the ES and EN catalogs differ). The feed shows the "feed" channel, the bell the "bell" channel (`NOTIFICATION_META`): N13 and N25 are bell-only, and N3, N11, N17-N19, N21, N27, N29-N31 are feed-only (so marking a feed-only item read does not change the bell count).
- **Formatting** (`format.ts`): both languages use US conventions ($1,250.50; "Jul 17, 2026" / "17 jul 2026"; whole amounts drop the decimals) because the platform is in dollars with many US-based Spanish speakers. Dates are always UTC. Spanish plural/number text inside ICU messages uses the plain locale (so "2000" has no separator in an ICU `#`).
- **Wording fixes after review:** English says "6-month streak" (not "6 months streak"); Spanish streak badges are "Racha de 3 meses" (lowercase). Existing databases keep the old seeded badge names (the seed never overwrites), so rebuild with `rm prisma/dev.db && npm run setup`.
- **Opted-out donors** (`gamificationOptOut`) are redirected from the dashboard, badges and feed to `/donations`, and get no bell or gamified nav. (There is no screen to toggle it until the profile page in step 10.)
- **Admins** are redirected from donor pages to `/admin`.
- **The "Share" button on badges is not there yet** (step 10 adds `/share/[badgeId]`); badge detail already shows the description, history, progress and rarity.
- **Rarity** = share of donors who have given something up to today that hold the badge (one decimal).
- **Baseline-dated badges:** tier and streak badges earned before launch show "Jul 1, 2026" (the baseline day) as their date, and so appear under "Recent badges" at the start. Lifetime clubs, first gift, years, programs and matching show their real dates.
- **Verified in a real browser** (Playwright, in the scratch folder, not a project dependency): real login through the form, screenshots of every page at desktop and phone width, bell open/close/Escape, mark one / all as read, language toggle on the feed that re-renders stored notifications. `node scripts/smoke.mjs [baseUrl] [user]` is a kept HTTP check of every page in both languages (needs the dev server).
- **A transient failure to keep an eye on:** once, right after `npm run setup`, all 14 test files failed to load; the immediate re-run passed (208 tests) and it did not recur.

## Step 10: Share, matching and profile

- **Share page** `/share/[badgeId]?period=`: a live preview of the card, the pre-written message (Spanish or English, with the badge name and `@alumn_usb`), a copy button, and one button per network: **WhatsApp** and **X** open with the message prefilled, **Facebook** and **LinkedIn** share only the link (their web share URLs take no text), and **Instagram** downloads the 1080×1920 story image (Instagram has no web share URL). The link is `https://alumnusb.org/dona?ref=USERn`, so the Recruiter badges can be credited. Every button records a share (`recordShareAction`: Proud Supporter badge, +5 engagement points) but only for a badge the donor has really earned. A badge you have not earned shows a message instead of a card.
- **The card** is `GET /api/share-card/[badgeId]?locale=&period=&format=card|story&download=1`, drawn with Next's `ImageResponse`: black background, the white logo, a tier-coloured ring around the badge icon, "BADGE EARNED / by {alias}" and a yellow "Donate at alumnusb.org" button. 401 if signed out, 404 if the badge is not the donor's. The alias replaces the username. Icons that are not emoji (the X logo) fall back to the badge's first letter. Emoji are drawn with Twemoji, which the image generator fetches at render time, so the first card needs internet access.
- **Share buttons appear** in the activity feed and the bell on the notifications that celebrate a badge (N1, N9, N16), and in the history of each badge's page.
- **Matching page** `/matching`: how it works (3 steps), a type-ahead search over the mock company list (`data/companies.json`, fictional employers, flagged as such; "no result" points to HR and to Double the Donation / Benevity), links to doublethedonation.com and benevity.com, and the donor's own Double Impact badges. The search runs in the browser over the 50-company list; there is no real Double the Donation API.
- **Profile page** `/profile`: preferred language (saved, and saving moves the visitor to that language), alias (tidied: spaces collapsed, `<>` removed, 30 characters), the gamification opt-out, the five follow buttons ("Follow" opens the real profile; "I followed" creates a pending claim, shows its status, and can be retried after a rejection), and the personal invitation link with a count of invited friends who have donated. Opted-out donors keep Donations, Matching and Profile, with no bell and no gamified pages.
- **Header** gained "Matching gifts" and "Profile"; the right-hand group stays right-aligned when the nav wraps.
- **`resetDemo` now also clears aliases and opt-outs** (and the first-login stamp), so a reset returns every account to a clean state. It was needed after a browser test left User3 with an alias.
- **Bug found in a real browser and fixed:** the company search passed functions as props to a client component, which crashes; it now takes text templates with `{platform}` / `{query}` placeholders.
- **Tests:** share URLs and alias cleanup (8), share buttons on N1/N9/N16 (1), reset clears preferences (1). Verified in a real browser (22 checks): share card image, referral link, WhatsApp popup, Proud Supporter earned from a real click, the Instagram download, an unearned badge, company search, profile save and language switch, pending claim, alias on the card, opt-out and opt-in. `scripts/smoke.mjs` now also checks the new pages and the card API (PNG at 1200×630, 401 signed out, 404 for an unearned badge). The suite is 217 tests; coverage is still 50/50 badges and 30/30 notification types.
- **Another transient test-load hiccup** (a file reported "no tests" right after being edited; the immediate re-run passed), like the one noted in step 9. It has not reproduced on demand.

## Step 11: Backoffice

**Sections** (all under `/admin`, admins only, ES/EN, with a tab bar and a floating time-machine bar on every page): Overview, Import, Donors (+ detail), Rankings, Badges (+ editor), Follow claims, Posts, At-risk recurring (+ CSV), Settings.

- **Time machine** (`TimeMachine`, `timeMachineAction`): +1 day / +1 week / +1 month, jump to a date, Reset demo (with a confirmation). Time only moves forward and stops at 2026-12-31; the date picker blocks past dates in the browser and the server refuses them too. It shows what it did ("Processed 7 days up to 2026-07-25: 12 new badges, 41 notifications"). The same control sits in a floating bar and, larger, at the top of Settings.
- **Overview:** total raised, raised this month, donors, donors giving this month, active recurring donors, MRR, at-risk count, badges awarded, claims waiting, and a 12-month chart (inline SVG). Computed live from the engine, so the numbers match what donors see.
- **Import:** upload donations (cumulative) and/or subscriptions (snapshot), see a preview (new / updated / unchanged / removed, problems with line numbers and field), then confirm. The files wait in a temp folder between the two steps (token-checked), only the first 50 problems per file are shown (the totals are kept), the result is logged as "Last import". `serverActions.bodySizeLimit` is now 25 MB (the default 1 MB would break on a real export; the demo file is 560 KB). Importing new history rows does not create notifications retroactively: use Reset demo afterwards.
- **Donors:** search by name, email or ID; the detail shows totals, the three live ranks, the login account, subscriptions with their status, every badge (automatic or manual) and the donation history. **Manual award / revoke:** an admin can give any badge (the donor gets an N1; not if they opted out); only *manual* awards can be revoked, because an automatic one would be awarded again the next day.
- **Rankings:** full tables with names for monthly (any of the last 18 months), yearly (last 6 years) and all-time, ordered by Impact Points or by dollars, top 50 (or 200), plus the history of Donor of the Week and Month with the amount that won.
- **Badges:** list with rule, awards, rarity and status; the editor changes the Spanish and English names and descriptions, the icon, active flag and the **thresholds** (generated from the rule: amount, months, years, top N, top %, count, tier, program, network). The rule's *type* never changes. Rule edits apply to the days still to be processed.
- **Follow claims:** pending queue with a link to the real profile, approve or reject (N24/N25, badge, +5 points, immediately through `reviewSocialClaim`), and recent decisions.
- **Posts:** bilingual composer with a live preview in both languages; a campaign adds slug, goal and dates. A post dated today or earlier notifies donors straight away (N27/N28). Deleting a post also deletes the notifications that pointed at it. There is no edit: delete and recreate.
- **At-risk recurring:** donors whose plan is in grace or inactive, with the monthly amount, the streak they stand to lose (the streak the day before the failure), days of grace left, failing since and last payment; CSV export at `/api/admin/at-risk`. CSV cells that start with `= + - @` are prefixed with an apostrophe so a spreadsheet will not run them as formulas.
- **Settings:** every setting with a plain-language explanation; numbers and text directly, structures as JSON. Everything is validated against the default's shape (and a few rules: tiers increase, milestones increase, grace of at least 1 day, MM-DD). If any value is invalid nothing is saved. The demo dates (launch, today, last processed) are read-only: the time machine owns them.
- **Security:** every server action calls `assertAdmin()` (the layout guard alone is not enough for actions); the CSV route returns 403 to anyone else.
- **Bugs found while testing, and fixed:**
  - Saving one setting also re-saved and reported the four JSON settings as changed: browsers send text areas with CRLF line endings, so the text comparison always failed. Values are now compared after parsing (`sameSetting`, key order and whitespace ignored).
  - `awardBadgeManually` took a database parameter but read the demo date through the global clock (the wrong database in tests). It now uses the injected one.
  - The Spanish time-machine message said "Se procesaron 1 día".
- **Tests added:** settings, rule, post, CSV and ISO-week logic (17), manual awards (3). A 43-check browser test covered the whole backoffice (time machine, a donor's claim approved by the admin, a manual badge awarded and revoked, badge edit with a rejected threshold, a post that reaches donors' feeds and is deleted with them, CSV download, settings, a CSV import with preview and a bad file, and Reset demo) with no browser errors. `node scripts/smoke.mjs <url> admin` checks every admin page in both languages. The suite is 237 tests; coverage is still 50/50 badges and 30/30 notification types.

## Step 12: Polish and final verification

- **404 and error pages:** `app/[locale]/not-found.tsx` (localized, inside the app shell) plus a catch-all `[...rest]` so *any* unknown address under a language shows it with a real HTTP 404; `app/[locale]/error.tsx` (a localized "Something went wrong" with Try again, using this Next version's `retry` prop). A loading skeleton was tried and **removed**: it made the server start streaming before a `notFound()` was discovered, so a missing badge answered 200 instead of 404.
- **Tab titles** on every page ("Badges · AlumnUSB", via `titleFor`), a **skip-to-content link**, and the last hard-coded labels translated (the unread dot, the admin nav's accessible name, the rankings filter button).
- **`npm run check:i18n`** statically checks every `t("…")` call (404 of them): the namespace of each translator (found through `getTranslations` / `useTranslations`, also inside `Promise.all`), literal keys, grouped keys like `columns.${c}` and partial ones like `preview${lang}`; plus that the two catalogs have identical keys. It is tested against deliberately broken fixture projects. It cannot see keys built entirely at run time; those are covered by the rendering tests.
- **Mobile pass** (screenshots at 390 px of every donor and admin page): everything stacks, tables scroll inside their card, and the floating time-machine bar, which took three rows, is now two: the date and the +1 buttons always, the date picker and Reset behind a "⋯" button on a phone.
- **README** rewritten: quick start, a 10-minute demo walkthrough (what to click and the date it happens), every command, how the rules work, the project layout, configuration, troubleshooting and what is out of scope.
- **Session cookie** is marked `Secure` only when the request really came over HTTPS (`x-forwarded-proto` or an https origin). Before, `NODE_ENV=production` forced it, which some browsers refuse on plain `http://localhost`, so a local `npm start` could not log in.
- **`npm test` retries once** if, and only if, *every* test file fails to load and no test ran (seen four times in the whole build, never reproducible on demand; the likely cause is a generated file being rewritten at that moment). The failing output goes to `.vitest-failure.log`, and the run prints a warning, so the cause can be found if it recurs. A real test failure is never retried.
- **`npm run typecheck`** now runs `next typegen` first (the route types are generated, not committed).
- **Verification from a fresh clone** (done in a scratch folder, in production mode): `npm install` → `npm run setup` → 244 tests, `check:i18n`, `verify-coverage` (50/50 badges, 30/30 notification types), typecheck, lint, `build`, `npm start`, then the README walkthrough through the real UI in a browser: 29 checks, in Spanish and English, no browser errors. **It found two real bugs that the working copy hid:** `.env.example` was never committed (the scaffold's `.gitignore` ignores `.env*`), so `npm run setup` crashed on a clone; and `tsc` failed before the first build because the route types did not exist yet.
