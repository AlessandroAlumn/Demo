# AlumnUSB Gamification Platform: Local Prototype Build Plan

You are building a **local prototype** of a gamification platform for AlumnUSB (alumnusb.org). AlumnUSB is a nonprofit that raises funds for Universidad Simón Bolívar (USB), Venezuela.

Donors log in and see:
- how much they've donated;
- their **private** rank (their own position only);
- the badges they've earned;
- a feed of notifications.

An admin manages everything from a backoffice.

**Companion spec:** [BADGES_AND_NOTIFICATIONS.md](BADGES_AND_NOTIFICATIONS.md) is the source of truth for:
- every badge (IDs `B-*`);
- every notification (IDs `N*`);
- the Impact Points formula.

Implement **all** of them. Use these IDs in code.

**Working rules**
- Environment: Windows 11, Node 24, npm 11, git available.
- Work through the build order in section 12, step by step. Finish each step's checkpoint before moving on.
- If something is ambiguous, pick the simplest reasonable option and record it in `DECISIONS.md`. Don't stop to ask unless it blocks you.
- `git init` at the start and commit after each step.

---

## 1. Fixed decisions

| Topic | Decision |
|---|---|
| Scope | Local only. No deployment, no real payments, no email. |
| Languages | Spanish (default) and English. Toggle in the header. The choice is persisted. |
| Login | Username field plus a password field that is shown but **ignored** (placeholder). Valid users: `User1`–`User20` (donors) and `admin`. Show a visible "DEMO" tag. |
| Privacy | A user sees only their **own** amounts and positions. They never see other donors' names or amounts. The single exception is the anonymous gap to the next position (N6). The admin sees everything. |
| Rankings | Three: **Monthly**, **Yearly** (calendar year), **All-time**. Ranked by **Impact Points**. |
| Donor of the Week/Month | Highest **dollar** amount in the period (not points). |
| Matching gifts | Arrive as donation rows with `method = matching_gift`. Earn a "Double Impact {year}" badge at most once per year. |
| Data source | Cumulative CSVs, imported idempotently. |
| Theme | Colors and fonts extracted from alumnusb.org's CSS. Mostly black, white and yellow, sometimes blue. |

---

## 2. Stack

- **Next.js** (latest stable, App Router) with **TypeScript**.
- **Tailwind CSS**, with brand colors defined as theme tokens in one place.
- **Prisma + SQLite**: a single file DB, no services to install.
- **next-intl**:
  - locale-prefixed routes `/es/...` and `/en/...`;
  - messages in `messages/es.json` and `messages/en.json`;
  - locale-aware number, currency and date formatting.
- **Vitest** for the engine unit tests.
- **`next/og` (ImageResponse)** for badge share-card images.
- No other heavy dependencies unless needed. Small ones are fine:
  - a CSV parser such as `papaparse` or `csv-parse`;
  - a seeded random generator for mock data.

The app must run with `npm install`, `npm run setup` and `npm run dev`. `npm run setup` does this:
1. migrates the DB;
2. generates the mock CSVs if they're missing;
3. imports them;
4. seeds users and badges;
5. runs the processing pipeline up to the default simulated date.

---

## 3. Theme extraction (do first)

1. Fetch `https://alumnusb.org`, find its stylesheet `<link>`s, and fetch those CSS files.
2. Extract:
   - the most-used brand hex colors (expect black, white, a yellow and a blue);
   - the font families.
3. Download the logo files (the white "Logo-Blanco" wordmark and the footer variant) into `public/brand/`.
4. Define Tailwind tokens:
   - `brand-black`, `brand-white`, `brand-yellow`, `brand-blue`;
   - grays as needed;
   - badge tier colors: bronze, silver, gold, platinum, diamond.
5. Load the same fonts from Google Fonts if they're available there. Otherwise use the closest match.
6. Record the extracted values, and their source, in `DECISIONS.md`.

Look and feel:
- the header looks like the main site (dark with the white logo);
- yellow for highlights, rank cards and gold accents;
- blue for links and information;
- clean cards;
- mobile-first and responsive.

---

## 4. Data

### 4.1 `data/donations.csv`: cumulative, one row per charge attempt

| Column | Type | Notes |
|---|---|---|
| `donation_id` | string | Permanent unique ID. Upsert key. |
| `donor_id` | string | e.g. `D0001` |
| `email` | string | |
| `name` | string | |
| `date` | ISO date | |
| `amount_usd` | decimal | |
| `method` | enum | `card`, `paypal`, `zelle`, `check`, `crypto`, `matching_gift` |
| `program` | enum | `becas`, `premio_planchart`, `transporte`, `infraestructura`, `fondo_general_emergencia`, `concurso_proyectos`, `eventos` |
| `campaign` | string, optional | slug, e.g. `emergencia-sismo-2026` |
| `status` | enum | `succeeded`, `failed` |
| `subscription_id` | string, optional | set for recurring charges |
| `referred_by` | donor_id, optional | set on a donor's first donation if they were referred |

### 4.2 `data/subscriptions.csv`: snapshot, replaced on each import

| Column | Notes |
|---|---|
| `subscription_id` | |
| `donor_id` | |
| `amount_usd` | per charge |
| `frequency` | `monthly` or `annual` |
| `start_date` | |
| `end_date` | blank, or the cancellation date |
| `status` | the real current status. Informational only in the prototype. |

**Status as of date D** is computed from the donation rows, so the time machine works. Check these in order:
1. `cancelled` if `end_date ≤ D`.
2. `failed` if the latest charge on or before D failed, or if there has been no successful charge in the last 35 days (monthly) or 370 days (annual).
3. `active` otherwise.

The **grace period** is 7 days from the first failure. When it expires:
- the streak resets;
- the status shown to the user becomes "inactive".

### 4.3 Importer

The importer is shared by `npm run import` and the backoffice upload page. It must:
- Validate every row. Produce a report with row numbers, errors, and counts of new, updated and unchanged rows.
- Upsert donations by `donation_id`. Re-importing the same file changes nothing.
- Replace subscriptions entirely.
- Derive the `Donor` records from the rows.
- Show the backoffice upload as a preview first, and import only on confirm.

### 4.4 Mock data generator: `scripts/generate-mock-data.ts`

The generator must be **deterministic** (fixed seed). Write its output to `data/` and commit it.

- **Date range:** donations from **2016-01-01** to **2026-12-31**.
  - Future-dated rows are intended. They "appear" as the simulated date advances.
- **500 donors in total** (decided later, to keep the demo simple): 475 background donors with anonymous mock names, plus the 20 personas and the 5 donors User14 refers.
  - About 30% are recurring: mostly $20–$50/month, a few at $100, $250 and $500+, and some annual.
  - One-time gifts follow a log-normal spread of about $10–$2,000.
  - Spread first-donation dates across the years. Include churn and a few failures.
  - Aim for roughly 120–180 donors with a donation in any given month.
  - Spread donations across all programs. Weight them toward `becas`.
  - Put about 5% of donors in the `emergencia-sismo-2026` campaign, Aug–Nov 2026.
  - Give about 3% of donors a yearly `matching_gift` row.
- **The 20 personas** (section 5) are hand-defined in `scripts/personas.ts` and mapped to donors `D0001`–`D0020`.
- **`data/companies.json`:** about 50 mock companies, each with `{ name, matches: boolean, platform: "Double the Donation" | "Benevity" | "Other" | null }`. Used by the matching-gifts search.

---

## 5. Personas (`User1`–`User20` ↔ `D0001`–`D0020`)

Design the data so that **stepping the time machine from 2026-07-01 to 2026-12-31 triggers every badge and every notification** for at least one persona.

| User | Persona | Must demonstrate |
|---|---|---|
| User1 | Big donor: $500/month recurring plus large one-time gifts. Lifetime over $10K. | Diamond Recurring, $10K Club, Donor of the Month (several times), Donor of the Week, #1 ("Keep your lead") |
| User2 | Loyal $25/month since mid-2024 | Recurring, 12-month and then 24-month streak, streak bonus in points |
| User3 | $100/month. Card fails 2026-07-15, recovers 2026-07-19 (within grace). | Gold, N12 banner, N13, N15 recovered, streak kept |
| User4 | $50/month. Fails 2026-08-03, grace expires, reactivates 2026-10-05. | N12, N13, N14 (streak reset), then Back in the Game and N15 |
| User5 | Brand new: first donation 2026-07-10 | First Gift, Welcome (N31), early climbs |
| User6 | Matching gifts in 2024, 2025 and 2026 (the 2026 one lands in Sept) | Double Impact {year}, Matching Streak, N22 |
| User7 | Mid-ranked, then a big one-time gift in Sept 2026 | Biggest Climber, big N4 jumps, Platinum (starts $250/month in Oct) |
| User8 | Lifetime $235 at the start, small gift later | N3 nudge for the $250 Club, then the badge |
| User9 | $45/month, raises to $50 in Oct | N17 upgrade nudge, then Silver and N16 |
| User10 | Lapsed: last donation Dec 2025 | N21 lapsed nudge, low/unranked monthly |
| User11 | Has donated to all 4 permanent programs (the 4th in Aug) | All the program badges, Full Spectrum |
| User12 | Gives to the earthquake campaign | Campaign Hero, N28, N29 |
| User13 | Engagement-focused, small donor, no social badges at the start | Demo social claims (pending → approved/rejected), N24, N25, engagement points (+5 each, max 20/month) |
| User14 | Referred 2 background donors (via `referred_by`), one in Aug 2026 | Recruiter, N26 |
| User15 | Local ambassador | Ambassador badge, pre-awarded manually by the admin in the seed |
| User16 | Has donated every year since 2016; first-gift anniversary in Aug | 3-, 5- and 10-Year Supporter, Anniversary (N20) |
| User17 | Near-identical totals to User18; they overtake each other several times | Frequent N4/N5 with small moves (#215 → #214), N6 gap |
| User18 | User17's rival | Same as User17 |
| User19 | Annual recurring $600/year (= $50/month) | Silver via annual normalization |
| User20 | Occasional $10 gifts; near the bottom of the ranking | An honest low rank (e.g. "#130 of 140"), Top 10% never reached |

Also cover these with at least one persona each:
- Monthly Top 10 and Top 10%
- Yearly Top 10 at the year close
- $100, $250, $500, $1K, $2.5K and $5K Clubs
- 3- and 6-month streaks
- Proud Supporter (the user shares a badge in the UI)
- Fully Connected
- N7 month close, N8 year close, N11 new month
- N18 donation received, N19 impact equivalence
- N27 admin post (seed 2–3 bilingual posts)
- N30 org milestone (e.g. org total passes $1M during the demo)

---

## 6. Database (Prisma)

The schema has the following models. Adjust as needed and document the changes.

- `Donor`
  - id, email, name, first donation date
  - derived; all donors, including background ones
- `Donation` (mirrors the CSV)
- `Subscription` (mirrors the CSV)
- `User`
  - id, username, role (`donor` | `admin`), donorId (nullable)
  - locale, alias (shown on share cards), gamificationOptOut, firstLoginAt
- `BadgeDefinition`
  - id (`B-M1`, …), category
  - nameEs, nameEn, descEs, descEn
  - rule (JSON thresholds, editable), icon, tier color, repeatable, manualOnly, active
- `BadgeAward`
  - donorId, badgeId, awardedAt, periodKey (for repeatable badges, e.g. `2026-W31`, `2026-08`, `2026`, a campaign slug)
  - source (`auto` | `manual`)
  - unique on (donorId, badgeId, periodKey)
- `RankSnapshot`
  - donorId, ranking (`monthly` | `yearly` | `alltime`), periodKey, asOfDate, rank, totalRanked, points
  - Keep the **latest** snapshot per donor, ranking and period.
  - Also keep **month-start** all-time snapshots, for Biggest Climber.
- `Notification`
  - userId, type (`N1`…`N31`), params (JSON), createdAt (simulated date), readAt, dedupeKey (unique)
- `SocialClaim`
  - userId, network, status (`pending` | `approved` | `rejected`), createdAt, reviewedAt
- `ShareEvent`
  - userId, badgeId, network, createdAt
- `Post`
  - titleEs, titleEn, bodyEs, bodyEn, kind (`news` | `campaign`), campaign slug, goal amount, startDate, endDate, publishedAt
- `Setting`
  - key/value JSON. Includes:
    - `simulatedToday`, `lastProcessedDate`, `launchDate` (default `2026-07-01`)
    - point weights and caps
    - recurring tier thresholds
    - grace days (7), failure window days (35/370)
    - gap-nudge threshold
    - lapsed months (6)
    - matching reminder date (e.g. `09-01`)
    - impact equivalences (placeholder values such as `$300 ≈ 1 month of a scholarship`; mark them as placeholders in the UI)

**Important:** store notifications as `type + params`, never as rendered text. Render them at view time in the current locale. Switching the language must translate old notifications too.

---

## 7. Engine (`lib/engine/`): pure functions, unit-tested

All engine code takes an explicit `asOf` date. **Never use the real clock.** Use `getToday()`, which reads `simulatedToday`.

### 7.1 `points.ts`: Impact Points

Points are per donor per period, counting only **succeeded** donations on or before `asOf`.

| Source | Points |
|---|---|
| One-time donation | 1 pt per $1 |
| Recurring donation (has `subscription_id`) | 1.5 pts per $1 |
| `matching_gift` | 1 pt per $1 |
| Streak bonus | +5 × current streak months, max +60, added in each month with a successful recurring charge |
| Engagement (approved social claim, share event, referred donor's first donation) | +5 each, max 20 per calendar month |

- Yearly and all-time points are sums over their months. The caps apply per month.
- All values come from `Setting`.

### 7.2 `rankings.ts`

- **Eligibility:** at least one succeeded donation in the period. Engagement alone never qualifies.
- **Sort order:** points descending. Ties go to whoever made their first donation in the period earliest.
- Output per donor: `{ rank, totalRanked, points, percentileTop }`. `percentileTop` is e.g. "Top 11%".
- **Gap to next position (N6):** `pointsAbove − myPoints`, shown as the smallest whole-dollar one-time gift that strictly passes them: `floor(gap) + 1`. Rank #1 gets "Keep your lead".
- Users who opted out of gamification are still counted in rankings. They just see no gamification UI.

### 7.3 `subscriptions.ts`

- Status as of a date (section 4.2).
- Grace period state.
- Streak length: consecutive calendar months with a succeeded charge. Annual subscriptions count each covered month.
- Current monthly recurring amount: active subscriptions summed, with annual ÷ 12.
- Current tier.

### 7.4 `badges.ts`

- Evaluate every rule in BADGES_AND_NOTIFICATIONS.md, for **all donors**. Rarity % needs all donors.
- Awards are idempotent through the unique key.
- Period-close badges are awarded only when the period has fully closed on or before `asOf`:
  - Donor of the Week: ISO weeks, Monday–Sunday.
  - Donor of the Month, Monthly Top 10, Monthly Top 10%, Biggest Climber.
  - Yearly Top 10.
- Biggest Climber: the largest all-time rank gain between the start and end of the month, among donors already ranked at the start.
- Early Adopter: awarded on first login, if within 30 days of `launchDate`.
- Manual-only badges (Ambassador) are never auto-awarded.

### 7.5 `notifications.ts`

- Create notifications **only for donors who have a User account** (User1–20).
- Each has a dedupeKey so it is never created twice.
- Rules follow the N-table in BADGES_AND_NOTIFICATIONS.md. In particular:
  - **N4/N5:** compare the new rank with the last snapshot for each of the 3 rankings. **Any change, even 1 position**, creates one notification per changed ranking, e.g. `#215 → #214 of 2,000`.
  - **N6:** append the gap line to N4/N5. Also send it standalone when the gap is ≤ the gap-nudge threshold (default $20), at most once every 7 days per ranking.
  - **N12/N13:** these are also shown as a **persistent banner** on the dashboard while the subscription is failed or in grace.
  - **N3 and N17 nudges:** send when within about 10% (or the threshold) of the next milestone or tier, once per target.

### 7.6 `process.ts`: the pipeline and the time machine

`processUntil(targetDate)` steps **day by day** from `lastProcessedDate + 1` to `targetDate`. For each day it:
1. computes subscription states;
2. computes rankings and snapshots;
3. evaluates badges, including any period that closed that day;
4. emits notifications.

Then it sets `lastProcessedDate`.

Admin time-machine controls (in Settings and in a small floating admin bar):
- **+1 day**, **+1 week**, **+1 month**, **jump to date**;
- **Reset demo**:
  - deletes the derived data (awards except manual ones, snapshots, notifications, claims, shares);
  - sets `simulatedToday = launchDate`;
  - re-processes.

Time can only move forward, except through Reset.

Performance target: +1 month with a few thousand donors (the demo uses 500) in under about 10 seconds. Optimize with in-memory computation per step, so you aren't doing per-row DB queries.

**Unit tests (Vitest)** are required for:
- points, including caps;
- ranking order, tie-break and gap;
- subscription status, grace period and streak;
- each badge category;
- N4/N5/N6 generation;
- importer idempotency.

---

## 8. User-facing app (`/[locale]/...`)

Header:
- logo;
- nav;
- **ES/EN toggle** (it keeps the current page);
- notification **bell** with unread count and a dropdown of the latest items;
- user menu.

A small "DEMO · today is {simulatedToday}" chip.

| Page | Content |
|---|---|
| `/login` | Username + password (placeholder, ignored) + language toggle. A hint lists `User1`–`User20` and `admin`. |
| `/dashboard` | Payment-problem **banner** (N12/N13) when relevant. **Totals:** lifetime, this year, this month. **3 rank cards** (Monthly, Yearly, All-time): "#52 of 500 · Top 11%", the change since the last update (⬆/⬇), and the gap line. **Recurring status card:** amount, tier, active/paused/inactive, streak, next-tier nudge. Recent badges. Impact equivalence. Latest feed items. |
| `/donations` | Personal history table: date, amount, program, campaign, method, status. Totals per program. |
| `/badges` | All badges grouped by category: earned (with date and ×count) or locked (with progress, e.g. "$180 / $250"). Rarity %. Click a badge for its detail and a **Share** button. |
| `/feed` | Full notification list. Mark as read / mark all as read. Admin posts and campaign cards with progress bars. |
| `/share/[badgeId]` | Share card preview (generated image), plus pre-written ES/EN text with the donate link `https://alumnusb.org/dona?ref={code}`. Buttons: WhatsApp (`wa.me/?text=`), X intent, Facebook sharer, LinkedIn share, and "Download for Instagram story" (a 1080×1920 image). Clicking a button records a `ShareEvent`. |
| `/matching` | What matching gifts are; how Double the Donation and Benevity work; a mock company search over `companies.json`; a link out to doublethedonation.com; "ask HR whether your company uses Benevity". The user's own Double Impact badges. |
| `/profile` | Language, alias, gamification opt-out. Social follow claims: for each network, a "Follow" link (opens the real profile: IG/TikTok @alumn_usb, X @Alumn_USB, YouTube AlumnUSB, Facebook alumnusb) and an "I followed" button. The button creates a pending claim and shows its status. Shows the referral link. |

A user who opted out sees their donations and their profile only.

---

## 9. Backoffice (`/[locale]/admin/...`, admin only)

| Page | Content |
|---|---|
| Overview | KPIs: total raised, donors this month, active recurring donors and MRR (monthly recurring revenue), at-risk count, badges awarded. A simple chart of monthly totals. |
| Import | CSV upload for both files → validation preview → confirm → report. The last import log. |
| Donors | Search by name, email or ID → donor detail: donations, subscriptions, badges, ranks, linked user. Manual badge award and revoke. |
| Rankings | Full tables **with names**, by points and by $, for monthly, yearly and all-time. Pick the period. Week/month winners history. |
| Badges | Edit names and descriptions (ES/EN), thresholds (rule JSON through a simple form), icon, active flag. Shows rarity. |
| Social claims | Pending queue → approve / reject (triggers N24/N25 and the badge). |
| Posts | Bilingual post and campaign composer, with goal, dates and a preview in both languages. |
| At-risk recurring | Donors whose subscriptions are failed or in grace: days left in grace, monthly amount, streak at stake. CSV export. |
| Settings | All `Setting` values, plus the **time machine** and **Reset demo**. |

---

## 10. i18n requirements

- Every user-visible string is in both `messages/es.json` and `messages/en.json`, including badge names (from the DB), notification templates, error messages and the admin UI.
- Add a test or script that fails if a key exists in one file but not the other.
- Currency is always USD, formatted per locale. Dates are formatted per locale.

---

## 11. Out of scope (later phases; don't build)

- Real authentication (later: an email magic link matched to the donor's email)
- Email, WhatsApp or push delivery
- Real payment processor or Google Sheets / Apps Script integration
- A real Double the Donation API
- Deployment
- Graduating-class leagues
- Year in Review

Keep the importer and the engine cleanly separated, so a real data source can replace the CSV later.

---

## 12. Build order (commit after each step)

1. **Scaffold.** Next.js + TS + Tailwind + Prisma (SQLite) + next-intl + Vitest. Theme extraction (section 3) and tokens. Layout with header and ES/EN toggle. **Check:** `/es` and `/en` render with the brand look.
2. **Schema.** Prisma models (section 6), migration, settings seed, badge definitions seeded from BADGES_AND_NOTIFICATIONS.md.
3. **Mock data.** The generator and personas (sections 4.4 and 5). **Check:** CSVs exist, 500 donors, personas present.
4. **Importer.** CLI + library, with idempotency test. **Check:** importing twice gives "0 new".
5. **Login and sessions.** Cookie-based. Route guards for donor vs admin.
6. **Engine.** `subscriptions`, `points`, `rankings`, with tests.
7. **Badges engine**, with tests.
8. **Notifications and pipeline.** `processUntil`, the time machine and Reset, with tests for N4/N5/N6. **Check:** stepping from 2026-07-01 to 2026-12-31 produces every badge ID and every N type at least once. Write a script, `npm run verify-coverage`, that reports any missing.
9. **User UI.** Dashboard, donations, badges, feed, bell, banner.
10. **Share, matching and profile.** Share cards and images, the matching page, social claims, the referral link.
11. **Backoffice.** All the section 9 pages.
12. **Polish.**
    - i18n completeness check
    - mobile layout pass
    - empty and error states
    - `README.md` with setup steps and a **demo walkthrough**, e.g.:
      1. log in as User3;
      2. as admin, advance to 2026-07-16;
      3. see the banner;
      4. advance to 2026-07-20;
      5. see the recovery;
      6. log in as User17 and User18 to watch them overtake each other; …

**Done when:**
- `npm run setup && npm run dev` works on a fresh clone;
- all tests pass;
- `verify-coverage` reports nothing missing;
- the README walkthrough works end to end in both languages.
