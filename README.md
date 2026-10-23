# AlumnUSB Gamification: local prototype

A gamification platform for [AlumnUSB](https://alumnusb.org), the nonprofit that raises funds for Universidad Simón Bolívar.
Donors see what they have given, earn badges, and get a **private** ranking position (like Duolingo: "#52 of 145", never
other donors' names or amounts). An admin runs everything from a backoffice. Spanish and English, with a toggle.

This is a **local prototype**: it runs on your computer from mock CSV files and has no real payments, email or passwords.
A **time machine** moves the demo clock forward so you can watch rankings change, badges arrive and notifications appear.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer (built with 24).

```bash
npm install
npm run setup      # creates the database, imports the mock data, creates the users, starts the demo at 2026-07-01
npm run dev        # then open http://localhost:3000
```

Sign in with **User1** to **User20** (donors) or **admin**. The password field is a placeholder: anything works.
Clicking a name under the login form fills it in.

## The demo in 10 minutes

The data covers 2016-2026 for **500 donors**; the demo starts on **2026-07-01** and runs to **2026-12-31**.
Use the dark **time machine bar** at the bottom of every admin page (`+1 day`, `+1 week`, `+1 month`, a date picker under
`⋯` on a phone, and **Reset demo**). Open two browser windows: one signed in as `admin`, one as a donor.

| Try this | What you will see |
|---|---|
| **User3** pays $100/month and its card fails on Jul 15 | Advance to **Jul 16**: a red banner "your donation isn't going through… 6 days left", a notification, the streak at risk. Advance to **Jul 20**: the payment recovers, the streak is kept (notification N15). |
| **User4**'s card fails on Aug 3 and is never fixed | **Aug 3** failure, **Aug 8** "2 days left to save your streak", **Aug 10** grace expires: streak reset, status inactive (badges stay). On **Oct 5** they come back at $100 and earn *Back in the Game* and *Gold*. |
| **User17** and **User18** give the same small amounts and leapfrog each other | In July their monthly position keeps changing: "⬆ You moved up: #215 → #214", "You're only $6 away from #213". Moves *down* arrive as a weekly digest (see Settings). |
| **User1** gives big gifts | Donor of the Week on **Sun Jul 26**, Donor of the Month on **Jul 31** (also Aug, Oct, Dec; User7 wins September). The $10K Club on **Jul 20**; Diamond Recurring on **Jul 5**. |
| **User8** is $15 short of the $250 Club | A "you're $15 away" nudge from **Jul 2**; the badge on **Aug 20**. Click the badge, then **Share**. |
| **User9** pays $45/month, $5 short of Silver | A tier nudge from **Jul 2**; Silver when they raise to $50 on **Oct 15**. |
| **User6**'s employer matches gifts | *Double Impact 2026* and *Matching Streak* on **Sep 20**. The *Matching gifts* page has a company search. |
| The organization passes **$200K** | Everyone is told on **Sep 9** (and $225K on Dec 13). The earthquake campaign (from Aug 1) shows a progress bar and milestones. |
| **User13** follows AlumnUSB | Profile → **I followed** (TikTok). As admin: *Follow claims* → **Approve**. The donor gets the notification, the badge and +5 points. |
| Share a badge | Any earned badge → **Share**: a preview card, a pre-written message with your referral link, WhatsApp / X / Facebook / LinkedIn, and an Instagram story image. Sharing earns *Proud Supporter*. |

As **admin** also look at: **Import** (upload `data/donations.csv` again: "0 new, 5004 unchanged"), **Donors** (award the
Ambassador badge by hand), **Rankings** (full tables with names), **Badges** (edit a threshold), **Posts** (publish a
bilingual announcement that lands in every donor's feed), **At-risk recurring** (export CSV), **Settings**.

**Reset demo** (Settings or the bar) deletes notifications, automatic badges, claims, shares, aliases and opt-outs and
returns to 2026-07-01. The Ambassador badge given to User15 and the posts are kept.

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | Prepares a fresh clone: `.env`, database, mock data (if missing), import, users, baseline day |
| `npm run dev` / `npm run build` / `npm start` | Development server / production build / production server |
| `npm test` | All tests (about 240, 15 seconds) |
| `npm run verify-coverage` | Runs the whole demo on a copy of the database and checks that **every badge and every notification type** is produced |
| `npm run check:i18n` | Checks every translation key the code uses exists in English **and** Spanish |
| `npm run demo -- status \| reset \| advance --days 7 \| --months 1 \| --to 2026-09-30` | The time machine from the terminal |
| `npm run import [-- --dry-run]` | Imports `data/donations.csv` and `data/subscriptions.csv` |
| `npm run generate-data` / `npm run data:stats` | Regenerates the mock CSVs (deterministic) / prints their calibration report |
| `npm run inspect -- User3` | Prints a user's stored notifications |
| `node scripts/smoke.mjs [url] [user]` | With the dev server running: signs in and checks every page in both languages |

## How it works

**Data.** `data/donations.csv` is *cumulative* (one row per charge attempt, every time the whole history) and is imported
idempotently by `donation_id`: importing the same file twice changes nothing. `data/subscriptions.csv` is a *snapshot* that
replaces the previous one. Invalid rows are skipped and reported with their line number. If you regenerate the data, rebuild
the database: `rm prisma/dev.db && npm run setup` (the importer adds and updates, it never deletes).

**Ranking.** Everyone is ranked by **Impact Points**, in three rankings (monthly, yearly, all-time):
$1 one-time = 1 pt, $1 recurring = 1.5 pts, $1 matched by an employer = 1 pt, a streak bonus of +5 per month of streak
(max +60 a month), and +5 for each approved follow, shared badge or referred donor (max 20 a month). A donor must give in
the period to be ranked. Ties go to the earliest first gift. Donors see only their own position and, at most, the dollar
gap to the next one.

**Recurring payments.** A failed charge starts a 7-day *grace period*. Fixed in time: nothing is lost. Not fixed: the streak
resets and the plan is *inactive* (earned badges are never removed). Tiers (Recurring $20, Silver $50, Gold $100,
Platinum $250, Diamond $500 a month; annual plans count as 1/12) come from the current monthly amount.

**Badges and notifications.** 50 badges and 31 notification types are listed in
[BADGES_AND_NOTIFICATIONS.md](BADGES_AND_NOTIFICATIONS.md). The daily pipeline (`src/lib/pipeline.ts`) steps one simulated
day at a time: rankings, badges, notifications. The first day (2026-07-01) is a silent baseline. Notifications are stored as
a type plus values and rendered when read, so switching language translates old ones too.

**Settings.** Every number above is editable in the backoffice (*Settings*), with one choice worth knowing: "someone passed
you" notifications are limited to one digest per ranking per week (`rankDownCooldownDays`, set 0 for every move).

## Project layout

```
src/app/[locale]/        pages (donor screens, /admin backoffice, login), 404 and error pages
src/app/api/             share card images (PNG) and the at-risk CSV
src/lib/engine/          the rules: points, rankings, subscriptions, badges, notifications (pure, tested)
src/lib/pipeline.ts      the daily pipeline and the time machine
src/lib/importer.ts      CSV import with validation, preview and idempotency
src/lib/*-queries.ts     what each screen reads
messages/                en.json and es.json (all text)
prisma/                  database schema and migrations (SQLite)
scripts/                 mock-data generator, personas, CLI tools, coverage and i18n checks
data/                    the mock CSVs (committed)
PLAN.md  DECISIONS.md    the build plan and every decision taken while building it
```

Configuration lives in `.env` (created by `npm run setup`): `DATABASE_URL` and `SESSION_SECRET` (any 16+ characters; it signs
the login cookie, and production refuses to start without one).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 with SQLite · next-intl · Vitest. Colors and fonts come
from alumnusb.org's own stylesheet (yellow `#F9CF00`, blue `#0050B4`, black `#111`; PT Serif, Roboto, Inter).
Next.js 16 differs from older versions: see `AGENTS.md` before changing framework code.

## Troubleshooting

- **Port 3000 is busy:** `npm run dev -- -p 3100`.
- **The demo looks wrong or stale:** Reset demo (Settings), or `npm run demo -- reset`.
- **Everything is empty or errors after changing the data:** `rm prisma/dev.db && npm run setup`.
- **Share cards show no emoji:** the card generator fetches emoji images, so it needs internet access the first time.
- **A test run reports "no tests" for every file:** it has happened once or twice right after `setup`; run `npm test` again.

## Not in this prototype

Real login (planned: an email magic link matched to the donor's email), email / WhatsApp notifications, a real payment
processor or Google Sheets / Apps Script feed, the Double the Donation API, deployment, graduating-class leagues and a
yearly "Year in review". The importer and the engine are separate from the CSV source, so a real data feed can replace it.
