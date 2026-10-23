# Putting the demo online (free)

Target: [Render](https://render.com) free web service. No credit card needed. The demo uses fictional data only.

## Read this first

- **Sleeps after 15 minutes** without visitors; the next visit takes about a minute to wake it.
- **Resets on every wake-up.** Files are not kept, so the demo returns to 2026-07-01 (the time machine, read notifications, etc. are lost). Fine for a demo; not for real data.
- **Build memory is unverified.** Render's free runtime has 512 MB. I could not confirm how much memory its *build* step gets. Locally, the lean build (`LOW_MEMORY_BUILD=1`, webpack, one worker, no type check) peaked at about 800 MB, and failed when I capped it at 512, 640 and 768 MB. If Render's build fails with "out of memory" or exit code 134, use the fallback at the end.
- **The admin has no password.** Keep the shared password on (step 4) and never load real donor data.

## Steps

1. **Put the code on GitHub** (private repo). Create an empty repo at github.com/new, then in the project folder:
   ```
   git remote add origin https://github.com/<you>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
2. **Render → New → Blueprint**, connect GitHub, pick the repo. Render reads [render.yaml](render.yaml).
3. Render asks for `DEMO_BASIC_AUTH`. Enter `user:password` (for example `demo:choose-something-long`). `SESSION_SECRET` is generated for you.
4. Click **Apply**. The first build takes several minutes. When it is live, open the `onrender.com` address; the browser asks for the shared password, then the login page appears (User1–User20, or admin).
5. Every `git push` to `main` redeploys.

Render checks `/api/health`, which is exempt from the password.

## If the build runs out of memory

Build somewhere with more RAM and let Render only run the result:

- Build on a GitHub Actions runner (7 GB RAM, free) and publish the output to a `deploy` branch that Render serves with a start-only command; or
- Use a host with more memory than 512 MB (a small paid Render instance, or a VPS).

I have not set up either; tell me which you prefer and I will.

## If you need data to persist

Pick one: a paid Render instance with a disk, a Fly.io volume, a VPS, or move the database from SQLite to Postgres (Prisma supports it; the schema needs a provider change and a fresh migration).
